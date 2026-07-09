import { useState, useCallback, useEffect } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { loadComponents, saveComponents } from '../lib/componentStorage';
import { parseSSEBuffer } from '../lib/streamParser';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  error: string | null;
  streamingCode: string;
  streamingPrompt: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = useState<GeneratedComponent[]>(() =>
    loadComponents()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 생성 중 LLM 응답을 실시간으로 누적해 보여주기 위한 임시 상태(영속화하지 않음).
  const [streamingCode, setStreamingCode] = useState('');
  const [streamingPrompt, setStreamingPrompt] = useState<string | null>(null);

  useEffect(() => {
    saveComponents(components);
  }, [components]);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);
    setStreamingCode('');
    setStreamingPrompt(prompt);

    try {
      const res = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      // 스트림 개시 전 오류(키 누락 등)는 일반 JSON 응답으로 온다.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let finalCode: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { messages, rest } = parseSSEBuffer(buffer);
        buffer = rest;

        for (const msg of messages) {
          if (msg.type === 'delta') {
            accumulated += msg.text ?? '';
            setStreamingCode(accumulated);
          } else if (msg.type === 'done') {
            finalCode = msg.code ?? accumulated;
          } else if (msg.type === 'error') {
            throw new Error(msg.error || 'Failed to generate component');
          }
        }
      }

      if (finalCode === null) {
        throw new Error('스트림이 완료되지 않았습니다. 다시 시도해주세요.');
      }

      const newComponent: GeneratedComponent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        code: finalCode,
        createdAt: new Date(),
      };

      setComponents((prev) => [newComponent, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
      setStreamingCode('');
      setStreamingPrompt(null);
    }
  }, []);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, []);

  return {
    components,
    isLoading,
    error,
    streamingCode,
    streamingPrompt,
    generate,
    removeComponent,
    clearAll,
  };
}
