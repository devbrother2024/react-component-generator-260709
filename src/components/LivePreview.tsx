import { useState } from 'react';
import { LiveProvider, LivePreview as ReactLivePreview, LiveError } from 'react-live';

interface LivePreviewProps {
  code: string;
}

type ViewportId = 'mobile' | 'tablet' | 'desktop';

const VIEWPORTS: { id: ViewportId; label: string; width: number | null }[] = [
  { id: 'mobile', label: '모바일', width: 375 },
  { id: 'tablet', label: '태블릿', width: 768 },
  { id: 'desktop', label: '데스크탑', width: null },
];

export function LivePreview({ code }: LivePreviewProps) {
  const [viewport, setViewport] = useState<ViewportId>('desktop');

  const active = VIEWPORTS.find((v) => v.id === viewport) ?? VIEWPORTS[2];
  const frameMaxWidth = active.width ? `${active.width}px` : '100%';

  return (
    <div className="preview-panel">
      <div className="panel-header">
        <h3>미리보기</h3>
        <div className="viewport-toggle" role="group" aria-label="미리보기 뷰포트">
          {VIEWPORTS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`viewport-btn ${viewport === v.id ? 'viewport-btn--active' : ''}`}
              onClick={() => setViewport(v.id)}
              aria-pressed={viewport === v.id}
              title={v.width ? `${v.label} (${v.width}px)` : v.label}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <div className="preview-content">
        <LiveProvider code={code} noInline>
          <div className="preview-render">
            <div className="preview-frame" style={{ maxWidth: frameMaxWidth }}>
              <ReactLivePreview />
            </div>
          </div>
          <LiveError className="preview-error" />
        </LiveProvider>
      </div>
    </div>
  );
}
