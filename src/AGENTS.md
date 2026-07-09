# AGENTS.md — src (React 프론트엔드)

## Module Context

React 19 + Vite 프론트엔드. 프롬프트를 받아 `/api/generate`(Vite 프록시 → `:3002`)로 보내고, 돌아온 코드를 react-live로 렌더링해 미리보기와 코드 탭을 제공한다.

## Tech Stack & Constraints

- react-live의 `LiveProvider`를 `noInline` 모드로 쓴다. 따라서 렌더할 코드에는 반드시 `render(...)` 호출이 있어야 한다 (없으면 서버가 주입).
- 스타일은 `App.css`(전역 클래스) + 인라인 스타일. CSS 프레임워크·CSS-in-JS 라이브러리를 도입하지 않는다.
- 전역 상태관리 라이브러리 없음. 로컬 상태는 hooks, 생성 흐름은 `useComponentGenerator` 훅으로 관리한다.

## Implementation Patterns

- 서버 호출은 `hooks/useComponentGenerator.ts`에 집중한다. 컴포넌트에서 직접 `fetch`하지 않는다.
- 네트워크는 상대 경로 `/api/*`만 쓴다. 호스트·포트를 하드코딩하지 않는다 (프록시가 처리).
- 공유 타입은 `types/index.ts`에 둔다.

## Testing Strategy

- Vitest + Testing Library(jsdom). 테스트는 대상 옆에 `*.test.tsx`로 둔다 (`PromptInput.test.tsx` 패턴).
- `bun run test`로 실행. 세팅은 `src/test/setup.ts`.

## Local Golden Rules

- Don't: 프로바이더 키를 브라우저에서 프로바이더로 직접 보내지 않는다. 항상 `/api/generate`를 경유한다.
- Do: 생성 코드는 `LivePreview`(react-live)로만 렌더한다. `eval`이나 `new Function`으로 실행하지 않는다.
- Do: 사용자에게 보이는 오류는 인라인 UI로 표시한다. `alert()` 등 브라우저 모달을 쓰지 않는다.
