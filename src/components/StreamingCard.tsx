interface StreamingCardProps {
  code: string;
  prompt: string | null;
}

// 생성 중 LLM 응답(코드)을 실시간으로 흘려 보여주는 카드.
// 완성 전이라 미리보기(react-live)는 렌더하지 않고 코드 텍스트만 스트리밍한다.
export function StreamingCard({ code, prompt }: StreamingCardProps) {
  return (
    <div className="component-card streaming-card">
      <div className="card-header">
        <div className="card-title-group">
          <span className="streaming-badge" aria-live="polite">
            <span className="streaming-dot" aria-hidden="true" />
            생성 중
          </span>
          {prompt && <p className="card-prompt">{prompt}</p>}
        </div>
      </div>
      <div className="card-content">
        <div className="code-panel">
          <div className="panel-header">
            <h3>코드</h3>
          </div>
          <pre className="code-block code-block--streaming">
            <code>{code || '컴포넌트를 생성하고 있습니다...'}</code>
            <span className="stream-cursor" aria-hidden="true" />
          </pre>
        </div>
      </div>
    </div>
  );
}
