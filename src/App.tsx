import { useState, useEffect } from 'react';
import { PromptInput } from './components/PromptInput';
import { ComponentCard } from './components/ComponentCard';
import { StreamingCard } from './components/StreamingCard';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import type { Provider } from './types';
import './App.css';

const PROVIDER_CONFIG = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
} as const;

function App() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [provider, setProvider] = useState<Provider>('google');
  const [envKeys, setEnvKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
  });
  const {
    components,
    isLoading,
    error,
    streamingCode,
    streamingPrompt,
    generate,
    removeComponent,
    clearAll,
  } = useComponentGenerator();

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setEnvKeys(data.envKeys))
      .catch(() => {});
  }, []);

  const hasEnvKey = envKeys[provider];

  const handleGenerate = (prompt: string) => {
    if (!apiKey.trim() && !hasEnvKey) {
      setKeyError(
        `${PROVIDER_CONFIG[provider].label} API 키가 필요합니다. 아래에 입력하거나 .env에 설정하세요.`
      );
      return;
    }
    setKeyError('');
    generate(prompt, apiKey || undefined, provider);
  };

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    setApiKey('');
    setKeyError('');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-mark">RC</div>
        <div className="header-copy">
          <span className="eyebrow">React Component Generator</span>
          <h1>프롬프트로 만드는 UI 워크벤치</h1>
          <p>요청을 입력하고, 생성된 React 컴포넌트를 바로 미리보고 코드로 확인합니다.</p>
        </div>
      </header>

      <main className="workspace">
        <section className="composer-panel" aria-label="컴포넌트 생성">
          <PromptInput onGenerate={handleGenerate} isLoading={isLoading} />
        </section>

        <aside className="settings-panel" aria-label="실행 설정">
          <div className="settings-header">
            <span className="panel-kicker">Runtime</span>
            <h2>실행 설정</h2>
          </div>
          <div className="provider-select">
            <label htmlFor="provider">Provider</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
            >
              {Object.entries(PROVIDER_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="api-key-input">
            <label htmlFor="api-key">
              API Key
            </label>
            <div className="api-key-field">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  hasEnvKey
                    ? '서버 키 사용 중 (직접 입력으로 덮어쓰기 가능)'
                    : PROVIDER_CONFIG[provider].placeholder
                }
              />
              <button
                className="btn-toggle-key"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? '숨기기' : '보기'}
              </button>
            </div>
            <p className={`key-status ${hasEnvKey ? 'key-status--ready' : ''}`}>
              {hasEnvKey ? '.env 키가 연결되어 있습니다.' : '직접 입력하거나 서버 환경변수를 설정하세요.'}
            </p>
            {keyError && (
              <p className="settings-error" role="alert">
                {keyError}
              </p>
            )}
          </div>
        </aside>
      </main>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      <section className="results-section">
        {components.length > 0 && (
          <div className="results-header">
            <div>
              <span className="panel-kicker">Generated</span>
              <h2>생성된 컴포넌트</h2>
            </div>
            <button className="btn-clear" onClick={clearAll}>
              전체 삭제
            </button>
          </div>
        )}

        {components.length === 0 && !isLoading && (
          <div className="empty-state">
            <div className="empty-preview" aria-hidden="true">
              <div className="empty-window">
                <span />
                <span />
                <span />
              </div>
              <div className="empty-canvas">
                <div className="empty-card empty-card--primary" />
                <div className="empty-card" />
                <div className="empty-card empty-card--wide" />
              </div>
            </div>
            <div className="empty-copy">
              <h2>아직 생성된 컴포넌트가 없어요</h2>
              <p>
                왼쪽에 만들고 싶은 UI를 설명하면, 여기에서 바로 렌더링됩니다. 예시
                프롬프트를 눌러 시작해보세요.
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <StreamingCard code={streamingCode} prompt={streamingPrompt} />
        )}

        <div className="results-grid">
          {components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              onRemove={removeComponent}
              onRegenerate={handleGenerate}
              isLoading={isLoading}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
