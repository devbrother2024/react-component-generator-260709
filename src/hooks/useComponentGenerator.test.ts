import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useComponentGenerator } from './useComponentGenerator';

// SSE 청크들을 흘려보내는 최소 Response 목. 훅은 res.ok / res.body.getReader() / res.json()만 사용한다.
function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(enc.encode(chunk));
      controller.close();
    },
  });
  return { ok: true, body: stream } as unknown as Response;
}

describe('useComponentGenerator 스트리밍', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('delta를 누적하고 done의 code로 컴포넌트를 확정한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"delta","text":"const A"}\n\n',
          'data: {"type":"delta","text":" = () => null;"}\n\n',
          'data: {"type":"done","code":"const A = () => null;\\nrender(<A />);"}\n\n',
        ])
      )
    );

    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].code).toBe(
      'const A = () => null;\nrender(<A />);'
    );
    expect(result.current.components[0].prompt).toBe('버튼');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.streamingCode).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('스트리밍 엔드포인트로 요청한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse(['data: {"type":"done","code":"render(<A/>);"}\n\n'])
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/generate/stream',
      expect.anything()
    );
  });

  it('done.code가 없으면 누적된 delta들을 최종 코드로 쓴다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"delta","text":"render("}\n\n',
          'data: {"type":"delta","text":"<A/>);"}\n\n',
          'data: {"type":"done"}\n\n',
        ])
      )
    );

    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.components[0].code).toBe('render(<A/>);');
  });

  it('error 이벤트를 받으면 error를 설정하고 컴포넌트를 만들지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse(['data: {"type":"error","error":"boom"}\n\n'])
      )
    );

    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.components).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('스트림 개시 전 오류 응답(ok=false)은 error로 처리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'API key is required.' }),
      } as unknown as Response)
    );

    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.error).toBe('API key is required.');
    expect(result.current.components).toHaveLength(0);
  });
});
