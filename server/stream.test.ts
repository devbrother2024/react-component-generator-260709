import { describe, it, expect } from 'vitest';
import {
  formatSSE,
  splitSSE,
  dataFromSSEBlock,
  parseAnthropicDelta,
  parseGoogleDelta,
  mapUpstreamError,
} from './stream';

describe('formatSSE', () => {
  it('메시지 객체를 data: 줄과 빈 줄로 끝나는 SSE 블록으로 만든다', () => {
    expect(formatSSE({ type: 'delta', text: 'hi' })).toBe(
      'data: {"type":"delta","text":"hi"}\n\n'
    );
  });
});

describe('splitSSE', () => {
  it('빈 줄로 구분된 완결 이벤트들을 분리하고 나머지는 비운다', () => {
    expect(splitSSE('data: a\n\ndata: b\n\n')).toEqual({
      events: ['data: a', 'data: b'],
      rest: '',
    });
  });

  it('마지막 이벤트가 빈 줄로 끝나지 않으면 rest로 남긴다', () => {
    expect(splitSSE('data: a\n\ndata: b')).toEqual({
      events: ['data: a'],
      rest: 'data: b',
    });
  });

  it('완결 이벤트가 없으면 전부 rest로 남긴다', () => {
    expect(splitSSE('data: a')).toEqual({ events: [], rest: 'data: a' });
  });

  it('CRLF 개행을 LF로 정규화해 분리한다', () => {
    expect(splitSSE('data: a\r\n\r\ndata: b\r\n\r\n')).toEqual({
      events: ['data: a', 'data: b'],
      rest: '',
    });
  });
});

describe('dataFromSSEBlock', () => {
  it('data: 뒤 한 칸 공백을 제거해 페이로드를 반환한다', () => {
    expect(dataFromSSEBlock('data: {"x":1}')).toBe('{"x":1}');
  });

  it('event: 등 data가 아닌 줄은 무시한다', () => {
    expect(dataFromSSEBlock('event: delta\ndata: {"x":1}')).toBe('{"x":1}');
  });

  it('여러 data: 줄은 개행으로 잇는다', () => {
    expect(dataFromSSEBlock('data: line1\ndata: line2')).toBe('line1\nline2');
  });

  it('data 줄이 없으면 null을 반환한다', () => {
    expect(dataFromSSEBlock(': comment')).toBeNull();
  });
});

describe('parseAnthropicDelta', () => {
  it('content_block_delta의 text_delta 텍스트를 추출한다', () => {
    expect(
      parseAnthropicDelta({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hi' },
      })
    ).toBe('Hi');
  });

  it('텍스트 델타가 아닌 이벤트는 빈 문자열을 반환한다', () => {
    expect(parseAnthropicDelta({ type: 'message_start' })).toBe('');
    expect(
      parseAnthropicDelta({ type: 'content_block_start' })
    ).toBe('');
  });
});

describe('parseGoogleDelta', () => {
  it('candidates의 parts 텍스트를 이어붙인다', () => {
    expect(
      parseGoogleDelta({
        candidates: [{ content: { parts: [{ text: 'He' }, { text: 'llo' }] } }],
      })
    ).toBe('Hello');
  });

  it('parts가 없으면 빈 문자열을 반환한다', () => {
    expect(parseGoogleDelta({ candidates: [{ content: {} }] })).toBe('');
    expect(parseGoogleDelta({})).toBe('');
  });
});

describe('mapUpstreamError', () => {
  it('503을 포함하면 과부하 안내와 503 상태로 매핑한다', () => {
    expect(mapUpstreamError('Claude API error: 503')).toEqual({
      status: 503,
      error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('429를 포함하면 요청 과다 안내와 429 상태로 매핑한다', () => {
    expect(mapUpstreamError('Gemini API error: 429')).toEqual({
      status: 429,
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('그 외 메시지는 원문과 500 상태로 매핑한다', () => {
    expect(mapUpstreamError('boom')).toEqual({ status: 500, error: 'boom' });
  });
});
