---
name: create-pr
description: 현재 브랜치의 변경사항을 분석하여 PR을 생성합니다. "PR 만들어줘", "PR 올려줘", "pull request 생성", "/create-pr" 호출 시 반드시 실행하라.
context: fork
allowed-tools: Read Glob Grep Bash
---

# PR 생성 스킬

현재 브랜치를 분석하여 프로젝트 컨벤션에 맞는 PR을 생성합니다.

## 동작 방식

1. **브랜치 검증**: 현재 브랜치 확인, main에서 실행 시 경고
2. **diff 분석**: main과의 커밋 목록 및 변경 파일 수집
3. **템플릿 로드**: references/pr-template.md를 Read 도구로 읽어 본문 구성
4. **PR 생성**: upstream remote 감지 여부에 따라 적절한 플래그로 `gh pr create` 실행

## Step 1: 사전 검증

```
gh auth status
git branch --show-current
```

- `gh auth status` 실패 시: "gh auth login을 먼저 실행하세요." 출력 후 종료
- 현재 브랜치가 `main` 또는 `master`이면: 경고 출력 후 feature 브랜치 생성 여부 확인

## Step 2: diff 분석

```
git log main..HEAD --oneline
git diff main..HEAD --name-status
```

커밋 0개이면 "변경사항이 없습니다." 출력 후 종료.

## Step 3: 템플릿 로드 및 PR 본문 생성

Read 도구로 `.claude/skills/create-pr/references/pr-template.md`를 반드시 읽은 뒤 본문을 채운다.

**PR 제목 규칙**: `type: 요약` (70자 이내), 커밋이 단일이면 해당 메시지 그대로 사용.

**본문 채우기 순서**:
1. `## Summary`: 변경 목적을 2-3문장 (왜에 집중)
2. `## Changes`: 커밋을 타입별로 그룹핑하여 bullet 목록
3. `## Test Plan`: 변경 기능에 맞는 체크리스트
4. `## Notes`: breaking change, 환경변수, 의존성 변경 (없으면 "없음")

## Step 4: gh pr create 실행

upstream remote 있으면 (fork 레포):
```
gh pr create --title "<제목>" --body "..." --base main --head <fork계정>:<브랜치> --repo <upstream-owner>/<repo>
```

upstream 없으면 (일반 레포):
```
gh pr create --title "<제목>" --body "..." --base main
```

PR 생성 성공 시 URL 출력. 실패 시 에러 원인 분석 후 해결 방법 제안.

## 주의사항

- references/pr-template.md를 읽지 않고 본문을 임의 작성하지 마라
