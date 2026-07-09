# AGENTS.md — server (AI 프록시)

## Module Context

Bun 런타임에서 도는 AI 프록시. `Bun.serve`로 `:3002`에 뜨며, 브라우저 대신 API 키를 보관해 Anthropic/Google을 호출하고 응답을 react-live용 코드로 정규화한다. 프론트(`src/`)와는 HTTP(`/api/*`)로만 결합한다.

## Tech Stack & Constraints

- Bun 전역 API 사용: `Bun.serve`, `process.env`. Node 전용 서버 프레임워크(Express 등)를 도입하지 않는다.
- 프로바이더 SDK를 쓰지 않고 `fetch`로 REST를 직접 호출한다. 이 방식을 유지한다.
- 모델 ID는 `index.ts` 상단 상수로만 관리한다 (`claude-haiku-4-5-...`, `GOOGLE_MODELS`). 코드 곳곳에 흩뿌리지 않는다.

## Implementation Patterns

- 부수효과 없는 변환 로직은 `generator.ts`에 순수 함수로 둔다 (`stripCodeFences`, `ensureRenderCall`). 테스트 가능성을 위해 `Bun.serve` 핸들러와 분리한다.
- 모델 폴백은 `fallback.ts`의 `withModelFallback(models, attempt)`를 재사용한다. 직접 for-loop를 다시 짜지 않는다.
- 새 프로바이더 추가 시: `Provider` 유니온 + `ENV_KEYS` 항목 + `call<Provider>()` 함수 + `/api/generate` 분기 + `/api/config` 노출을 함께 갱신한다.
- 응답 후처리 순서를 지킨다: 원문 → `stripCodeFences` → `ensureRenderCall` → `{ code }` 반환.

## Testing Strategy

- `bun run test` (Vitest, `server/**/*.test.ts` 포함). 순수 함수 위주로 단위 테스트한다.
- `Bun.serve` 핸들러는 통합 테스트하지 않는 대신, 검증이 필요한 로직을 순수 함수로 뽑아 테스트한다 (`generator.test.ts`, `fallback.test.ts` 패턴).

## Local Golden Rules

- Don't: API 키(클라이언트 입력 키 포함)를 로그·에러 메시지·성공 응답에 넣지 않는다. 서버에 저장하지 않는다.
- Do: 모든 응답에 `CORS_HEADERS`를 붙인다. 업스트림 에러는 상태 코드 매핑(429/503 등)을 유지한다.
- Do: `SYSTEM_PROMPT`의 생성 코드 규칙을 바꾸면 `src`의 react-live `noInline`/`render()` 계약과 정합성을 확인한다.
