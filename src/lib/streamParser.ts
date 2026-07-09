// 서버의 SSE 스트림(`data: {type,...}\n\n`)을 증분 파싱하는 순수 함수.
// 청크 경계로 메시지가 쪼개질 수 있으므로, 미완결 조각은 rest로 돌려주고
// 호출부가 다음 청크와 이어붙여 다시 넘긴다.

export interface StreamMessage {
  type: 'delta' | 'done' | 'error';
  text?: string;
  code?: string;
  error?: string;
}

/**
 * 누적 버퍼에서 빈 줄(`\n\n`)로 완결된 SSE 이벤트들을 파싱해 메시지 배열로 만든다.
 * 완결되지 않은 마지막 조각은 rest로 남긴다. JSON 파싱 실패한 이벤트는 건너뛴다.
 */
export function parseSSEBuffer(buffer: string): {
  messages: StreamMessage[];
  rest: string;
} {
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';

  const messages: StreamMessage[] = [];
  for (const block of blocks) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');

    if (data === '') continue;
    try {
      messages.push(JSON.parse(data) as StreamMessage);
    } catch {
      // 완결됐지만 JSON이 아닌 이벤트는 무시한다.
    }
  }

  return { messages, rest };
}
