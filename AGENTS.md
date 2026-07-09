# AGENTS.md — React Component Generator

## Project Context

프롬프트를 입력하면 AI가 단일 React 컴포넌트를 생성하고, `react-live`로 즉시 렌더링하며 코드를 함께 보여주는 워크벤치.
브라우저(`src/`)와 AI 프로바이더 사이에 Bun 프록시 서버(`server/`)를 두어 API 키를 서버에서만 다룬다.

Tech Stack: React 19, TypeScript, Vite, Bun(서버 런타임), react-live, Vitest.

## Operational Commands

패키지 매니저는 **bun 고정**. npm/yarn/pnpm 사용 금지.

```
bun install       # 의존성 설치
bun run dev       # API 서버(:3002) + Vite(:5173) 동시 실행 — 개발은 이 명령
bun run server    # API 서버만 (bun --watch)
bun run build     # 타입체크 + 프로덕션 빌드 (tsc -b && vite build)
bun run lint      # ESLint
bun run test      # Vitest 1회 (src/ + server/ 모두)
bun run test:watch
```

- 프론트는 상대 경로 `/api`로 호출하고 Vite가 `localhost:3002`로 프록시한다. 따라서 개발 시 `bun run dev`로 **서버와 프론트를 함께** 띄워야 생성이 동작한다.

## Golden Rules

### Immutable

- API 키를 하드코딩하지 않는다. 소스, 커밋, 서버 로그, 클라이언트 응답 어디에도 키를 노출하지 않는다.
- `.env` 파일을 커밋하지 않는다 (`.gitignore`에 포함됨).
- AI 프로바이더 호출은 **반드시 `server/` 프록시를 경유**한다. 브라우저에서 프로바이더 API를 직접 호출하지 않는다 (키 노출).

### Do's

- 프로바이더 추가·모델 변경·프롬프트 수정은 `server/`에서 한다.
- 사용자가 UI에 입력한 키(`clientKey`)는 `.env` 키보다 우선하는 기존 계약(`resolveApiKey`)을 유지한다.
- 생성 코드의 렌더 계약(import 금지, `React` 전역, `render(...)` 호출, inline 스타일, TypeScript 금지)을 바꿀 때는 `server/`의 `SYSTEM_PROMPT`와 `src/`의 react-live 렌더러를 **함께** 수정한다.

### Don'ts

- 포트·엔드포인트 URL을 프론트 코드에 하드코딩하지 않는다. 상대 경로 `/api`를 쓴다.
- 상태관리 라이브러리를 새로 도입하지 않는다. React hooks로 해결한다.

## Standards & References

- 프로젝트 소개·설치·기능 설명은 `README.md` 참조. 여기서는 반복하지 않는다.
- TypeScript strict, ESLint 규칙을 따른다. 커밋 전 `bun run lint`, `bun run test` 통과.
- Git: 브랜치는 `main`(배포), `feature/*`, `fix/*`, `chore/*`, `refactor/*`. 커밋 메시지는 한국어 `type: 요약` 형식. `/commit` 스킬을 사용한다.
- Maintenance Policy: 규칙과 실제 코드 사이에 괴리가 생기면 이 파일 업데이트를 제안한다.

## Context Map

- **[AI 프록시·프로바이더·키 처리 (server)](./server/AGENTS.md)** — 프로바이더 호출, 모델·폴백, 생성 코드 후처리, CORS/에러 매핑 작업 시.
- **[React UI·미리보기 (src)](./src/AGENTS.md)** — 컴포넌트, 훅, react-live 미리보기, 스타일 작업 시.
