// SSE(Server-Sent Events) 스트리밍을 위한 순수 함수들.
// 부수효과(Bun.serve, fetch)가 없어 단위 테스트가 가능하다.
// - formatSSE: 서버 → 클라이언트 프로토콜 메시지를 SSE 블록으로 직렬화.
// - splitSSE / dataFromSSEBlock: 누적 버퍼에서 완결 이벤트를 잘라내고 payload를 추출.
// - parseAnthropicDelta / parseGoogleDelta: 프로바이더별 스트림 청크에서 텍스트 델타를 추출.

/** 서버→클라이언트 메시지 객체를 `data:` 한 줄 + 빈 줄로 끝나는 SSE 블록으로 만든다. */
export function formatSSE(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * 스트림에서 누적한 버퍼를 빈 줄(`\n\n`)로 구분되는 완결 이벤트들과 나머지로 나눈다.
 * 완결되지 않은 마지막 조각은 `rest`로 남겨 다음 청크와 이어붙이도록 한다.
 */
export function splitSSE(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = parts.pop() ?? '';
  const events = parts.filter((part) => part.trim() !== '');
  return { events, rest };
}

/**
 * 하나의 SSE 이벤트 블록에서 `data:` payload를 추출한다.
 * `event:`/`id:`/주석 줄은 무시하고, 여러 `data:` 줄은 개행으로 잇는다(SSE 규격).
 * data 줄이 없으면 null.
 */
export function dataFromSSEBlock(block: string): string | null {
  const dataLines = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''));

  if (dataLines.length === 0) return null;
  return dataLines.join('\n');
}

interface AnthropicStreamEvent {
  type?: string;
  delta?: { type?: string; text?: string };
}

/** Anthropic 스트림 이벤트에서 텍스트 델타를 추출한다. 텍스트 델타가 아니면 ''. */
export function parseAnthropicDelta(event: AnthropicStreamEvent): string {
  if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return event.delta.text ?? '';
  }
  return '';
}

interface GoogleStreamChunk {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

/** Google 스트림 청크에서 parts 텍스트를 이어붙인다. 없으면 ''. */
export function parseGoogleDelta(chunk: GoogleStreamChunk): string {
  const parts = chunk?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part?.text ?? '').join('');
}

/**
 * 업스트림(프로바이더) 에러 메시지를 사용자용 안내 문구와 HTTP 상태로 매핑한다.
 * 비스트리밍/스트리밍 두 경로가 동일한 매핑을 공유한다.
 */
export function mapUpstreamError(message: string): { status: number; error: string } {
  if (message.includes('503')) {
    return {
      status: 503,
      error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    };
  }
  if (message.includes('429')) {
    return {
      status: 429,
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    };
  }
  return { status: 500, error: message };
}
