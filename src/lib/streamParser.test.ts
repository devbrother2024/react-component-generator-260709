import { describe, it, expect } from 'vitest';
import { parseSSEBuffer } from './streamParser';

describe('parseSSEBuffer', () => {
  it('완결된 단일 메시지를 파싱하고 rest를 비운다', () => {
    const { messages, rest } = parseSSEBuffer(
      'data: {"type":"delta","text":"hi"}\n\n'
    );
    expect(messages).toEqual([{ type: 'delta', text: 'hi' }]);
    expect(rest).toBe('');
  });

  it('한 버퍼의 여러 메시지를 순서대로 파싱한다', () => {
    const buf =
      'data: {"type":"delta","text":"a"}\n\n' +
      'data: {"type":"delta","text":"b"}\n\n';
    const { messages } = parseSSEBuffer(buf);
    expect(messages).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'delta', text: 'b' },
    ]);
  });

  it('완결되지 않은 마지막 조각은 rest로 남긴다', () => {
    const { messages, rest } = parseSSEBuffer(
      'data: {"type":"delta","text":"a"}\n\ndata: {"type":"del'
    );
    expect(messages).toEqual([{ type: 'delta', text: 'a' }]);
    expect(rest).toBe('data: {"type":"del');
  });

  it('done 메시지의 code를 파싱한다', () => {
    const { messages } = parseSSEBuffer(
      'data: {"type":"done","code":"render(<A/>);"}\n\n'
    );
    expect(messages).toEqual([{ type: 'done', code: 'render(<A/>);' }]);
  });

  it('잘못된 JSON 데이터는 건너뛴다', () => {
    const { messages } = parseSSEBuffer(
      'data: not-json\n\ndata: {"type":"delta","text":"ok"}\n\n'
    );
    expect(messages).toEqual([{ type: 'delta', text: 'ok' }]);
  });

  it('청크 경계로 쪼개진 메시지를 rest 이어붙이기로 완성한다', () => {
    const first = parseSSEBuffer('data: {"type":"delta",');
    expect(first.messages).toEqual([]);
    const second = parseSSEBuffer(first.rest + '"text":"x"}\n\n');
    expect(second.messages).toEqual([{ type: 'delta', text: 'x' }]);
  });
});
