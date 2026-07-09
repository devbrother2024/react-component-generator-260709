import { stripCodeFences, ensureRenderCall } from './generator';
import { withModelFallback } from './fallback';
import {
  formatSSE,
  splitSSE,
  dataFromSSEBlock,
  parseAnthropicDelta,
  parseGoogleDelta,
  mapUpstreamError,
} from './stream';

// 모델 ID는 이 파일 상단 상수로만 관리한다.
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
// 우선순위 순서. 앞 모델이 실패하면 다음 모델로 폴백한다.
const GOOGLE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];

const SYSTEM_PROMPT = `You are a React component generator. Generate a single React component based on the user's description.

Rules:
- Use inline styles only (no CSS imports, no CSS modules)
- Do NOT use import statements — React is already available in scope as a global
- Define the component as a function, then call render(<ComponentName />) at the end
- Make the component visually appealing with proper styling
- Use React hooks if needed (e.g., React.useState, React.useEffect)
- The component must be completely self-contained
- Respond with ONLY the code block — no explanations, no markdown fences
- Use descriptive variable names and clean formatting
- For colors, prefer modern palettes (gradients, shadows, etc.)
- Ensure the component is interactive where appropriate (hover states, click handlers, etc.)
- Do NOT use TypeScript syntax — no type annotations, no interfaces, no generics, no "as" casts. Write plain JavaScript only.

Example output format:
const GradientButton = () => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : 'linear-gradient(135deg, #764ba2, #667eea)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Click me
    </button>
  );
};

render(<GradientButton />);`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Provider = 'anthropic' | 'google';

const ENV_KEYS: Record<Provider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
};

function resolveApiKey(provider: Provider, clientKey?: string): string | null {
  return clientKey || ENV_KEYS[provider] || null;
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  return data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

async function callGoogleModel(prompt: string, apiKey: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates: Array<{
      content: { parts: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
  }

  return (
    candidate?.content?.parts
      ?.map((part) => part.text)
      ?.join('') ?? ''
  );
}

async function callGoogle(prompt: string, apiKey: string): Promise<string> {
  return withModelFallback(GOOGLE_MODELS, (model) => callGoogleModel(prompt, apiKey, model));
}

// ── 스트리밍 경로 ──────────────────────────────────────────────
// 프로바이더 SSE 스트림을 열고, 완결 이벤트를 파싱해 텍스트 델타를 흘려보낸다.
// 순수 파싱 로직(splitSSE/dataFromSSEBlock/parse*Delta)은 stream.ts에서 테스트한다.

/** 프로바이더 SSE 스트림을 읽으며 텍스트 델타마다 onDelta를 호출한다. */
async function pumpStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  parseDelta: (json: T) => string,
  onDelta: (text: string) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  const handleBlock = (block: string) => {
    const data = dataFromSSEBlock(block);
    if (!data || data === '[DONE]') return;
    try {
      const text = parseDelta(JSON.parse(data));
      if (text) onDelta(text);
    } catch {
      // 파싱 불가한 청크(부분 JSON 등)는 건너뛴다.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = splitSSE(buffer);
    buffer = rest;
    for (const event of events) handleBlock(event);
  }
  // 개행으로 끝나지 않은 마지막 블록을 flush한다.
  if (buffer.trim() !== '') handleBlock(buffer);
}

/**
 * Anthropic 스트림을 연다. 응답이 시작되기(첫 바이트) 전 실패는 여기서 throw한다.
 */
async function openAnthropicStream(
  prompt: string,
  apiKey: string
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Claude API error: ${response.status}`);
  }
  return response.body.getReader();
}

/**
 * Google 스트림을 연다. 모델 폴백은 "스트림 확립 전"까지만 적용한다.
 * 첫 응답이 200(ok)이면 그 모델에 커밋하고, 이후 스트림 중 오류는 폴백하지 않는다.
 */
async function openGoogleStream(
  prompt: string,
  apiKey: string
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  return withModelFallback(GOOGLE_MODELS, async (model) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    return response.body.getReader();
  });
}

/** 프로바이더별 스트림을 열고 텍스트 델타를 onDelta로 흘려보낸다. */
async function streamComponent(
  provider: Provider,
  prompt: string,
  apiKey: string,
  onDelta: (text: string) => void
): Promise<void> {
  if (provider === 'google') {
    const reader = await openGoogleStream(prompt, apiKey);
    await pumpStream(reader, parseGoogleDelta, onDelta);
  } else {
    const reader = await openAnthropicStream(prompt, apiKey);
    await pumpStream(reader, parseAnthropicDelta, onDelta);
  }
}

const server = Bun.serve({
  port: Number(process.env.PORT) || 3002,
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return Response.json(
        {
          envKeys: {
            anthropic: !!ENV_KEYS.anthropic,
            google: !!ENV_KEYS.google,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const { prompt, apiKey, provider = 'anthropic' } = (await req.json()) as {
          prompt: string;
          apiKey?: string;
          provider?: Provider;
        };

        const resolvedKey = resolveApiKey(provider, apiKey);

        if (!resolvedKey) {
          return Response.json(
            { error: `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.` },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (!prompt) {
          return Response.json(
            { error: 'Prompt is required' },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        const text =
          provider === 'google'
            ? await callGoogle(prompt, resolvedKey)
            : await callAnthropic(prompt, resolvedKey);

        const code = ensureRenderCall(stripCodeFences(text));

        return Response.json({ code }, { headers: CORS_HEADERS });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const { status, error } = mapUpstreamError(message);
        return Response.json({ error }, { status, headers: CORS_HEADERS });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/generate/stream') {
      try {
        const { prompt, apiKey, provider = 'anthropic' } = (await req.json()) as {
          prompt: string;
          apiKey?: string;
          provider?: Provider;
        };

        const resolvedKey = resolveApiKey(provider, apiKey);

        if (!resolvedKey) {
          return Response.json(
            { error: `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.` },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (!prompt) {
          return Response.json(
            { error: 'Prompt is required' },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        // 여기까지 통과하면 스트림을 연다. 스트림 확립 후의 오류는 HTTP 상태가 아니라
        // SSE `error` 이벤트로 전달한다(응답은 이미 200으로 시작됨).
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const encoder = new TextEncoder();
            const send = (payload: object) =>
              controller.enqueue(encoder.encode(formatSSE(payload)));

            let accumulated = '';
            try {
              await streamComponent(provider, prompt, resolvedKey, (text) => {
                accumulated += text;
                send({ type: 'delta', text });
              });

              // 후처리 순서 유지: 원문 → stripCodeFences → ensureRenderCall → code.
              const code = ensureRenderCall(stripCodeFences(accumulated));
              send({ type: 'done', code });
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error';
              send({ type: 'error', error: mapUpstreamError(message).error });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (err) {
        // 스트림 개시 전(본문 파싱 등) 실패는 일반 JSON 에러로 응답한다.
        const message = err instanceof Error ? err.message : 'Unknown error';
        const { status, error } = mapUpstreamError(message);
        return Response.json({ error }, { status, headers: CORS_HEADERS });
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  },
});

console.log(`API server running at http://localhost:${server.port}`);
