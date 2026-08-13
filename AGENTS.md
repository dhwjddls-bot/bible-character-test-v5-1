# Repository working agreement

이 저장소는 여러 컴퓨터와 여러 Codex 대화에서 이어서 작업합니다.

## 작업을 시작할 때

1. `HANDOFF.md`와 `README.md`를 먼저 읽습니다.
2. `git status --short --branch`, 현재 브랜치와 원격 상태를 확인합니다.
3. 로컬 변경이 있으면 사용자 작업으로 간주하고 보존합니다. 깨끗한 작업 트리에서만 원격 변경을 안전하게 받습니다.
4. 소스 저장소 `origin/main`을 개발의 단일 기준으로 사용합니다.

## 구현 원칙

- 사용자 화면과 콘텐츠는 자연스러운 한국어를 사용합니다.
- 질문 데이터는 `data/questions.js`, 인물 데이터는 `data/characters*.js`에서 관리합니다.
- 브라우저 공개용 키 외의 비밀값을 코드·문서·Git 기록에 넣지 않습니다.
- 원문 답변, 이메일, 타인 테스트의 이름·관계를 공유 링크나 서버 기록에 추가하지 않습니다.
- 사용자의 기존 변경을 덮어쓰거나 강제 초기화하지 않습니다.

## 검증과 인수인계

- JavaScript 변경 후 `npm test`를 실행합니다.
- 채점·인물 데이터 변경 후 `npm run simulate`도 실행합니다.
- 사용자 흐름을 바꿨다면 모바일·PC 화면과 정적 `index.html` 실행을 확인합니다.
- 의미 있는 작업을 마칠 때 `HANDOFF.md`의 현재 상태와 다음 작업을 갱신합니다.

## Git과 배포

- 소스: `origin` → `dhwjddls-bot/bible-character-test-v5-1`
- 운영 배포: `root-pages` → `dhwjddls-bot/dhwjddls-bot.github.io`
- 먼저 소스 저장소에 커밋·푸시합니다.
- 배포 요청이 있을 때만 검증된 같은 커밋을 `root-pages/main`에 푸시합니다.
- 강제 푸시는 하지 않습니다. 충돌이 나면 중단하고 원격과 로컬 변경을 비교합니다.
