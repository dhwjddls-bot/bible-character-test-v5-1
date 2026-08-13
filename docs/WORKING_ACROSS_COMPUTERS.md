# 회사와 집에서 이어서 작업하기

로컬 Codex 대화는 작업한 컴퓨터에 남지만, 코드와 진행 상황은 GitHub를 기준으로 공유할 수 있습니다. 이 저장소는 코드뿐 아니라 `HANDOFF.md`와 `AGENTS.md`도 함께 보관하므로 새 컴퓨터나 새 대화에서도 현재 상태를 복원할 수 있습니다.

## 집 컴퓨터에서 한 번만 설정하기

1. ChatGPT 데스크톱 앱과 GitHub Desktop을 설치합니다.
2. 두 앱 모두 회사 계정이 아닌 운영자의 같은 개인 계정으로 로그인합니다.
3. GitHub Desktop에서 **File → Clone repository → URL**을 엽니다.
4. 아래 주소를 입력해 문서 폴더처럼 기억하기 쉬운 곳에 복제합니다.

```text
https://github.com/dhwjddls-bot/bible-character-test-v5-1.git
```

5. ChatGPT 데스크톱 앱에서 로컬 프로젝트를 추가하고, 방금 복제한 폴더를 선택합니다.
6. 새 대화에서 다음과 같이 시작합니다.

```text
AGENTS.md, HANDOFF.md, README.md와 최근 Git 기록을 확인하고 작업을 이어서 진행해줘.
수정 전에 원격 최신 상태와 로컬 변경부터 확인해줘.
```

대화가 새로 시작돼도 저장소의 문서와 Git 기록을 읽으면 구현 상태, 다음 작업, 배포 구조를 다시 파악할 수 있습니다.

7. 집에서 공개 배포도 할 예정이라면 처음 한 번만 Codex에 아래처럼 요청합니다.

```text
공개 배포 저장소 https://github.com/dhwjddls-bot/dhwjddls-bot.github.io.git 을
root-pages라는 Git 원격으로 안전하게 연결해줘.
```

이 연결 정보는 컴퓨터마다 따로 저장되므로 새 컴퓨터에서는 한 번씩 설정해야 합니다.

## 매번 작업을 시작할 때

GitHub Desktop에서 저장소를 선택하고 **Fetch origin**을 누릅니다. 내려받을 변경이 있으면 **Pull origin**을 누른 뒤 Codex를 시작합니다.

Codex에는 아래처럼 요청하면 됩니다.

```text
원격 최신본을 확인하고, 로컬 변경을 보존한 상태로 이어서 작업해줘.
```

## 매번 작업을 마칠 때

Codex에 아래처럼 요청합니다.

```text
작업을 검증하고 HANDOFF.md를 갱신한 뒤 개인 GitHub 소스 저장소에 커밋하고 푸시해줘.
공개 사이트에도 반영해야 하는 변경이면 배포 저장소까지 동기화해줘.
```

푸시가 끝났다는 확인을 받은 뒤 다른 컴퓨터에서 작업을 시작합니다. 회사와 집에서 같은 시간에 수정하면 충돌하기 쉬우므로 한쪽 작업을 푸시한 다음 다른 쪽에서 최신본을 받는 순서를 지킵니다.

## 대화 자체도 그대로 사용하고 싶을 때

ChatGPT 데스크톱 앱의 Remote 연결을 사용할 수 있는 환경이라면 회사 PC의 **Settings → Connections → Control this PC**에서 원격 연결을 설정하고, 집 PC에서 같은 ChatGPT 계정과 워크스페이스로 접속할 수 있습니다.

이 방식은 회사 PC가 켜져 있고 온라인이어야 하며 회사 보안 정책의 허용을 받아야 합니다. 장기적인 프로젝트 기록은 Remote보다 GitHub와 `HANDOFF.md`를 기준으로 유지하는 편이 안전합니다.

공식 안내:

- 프로젝트와 로컬 폴더: https://learn.chatgpt.com/docs/projects
- 다른 기기에서 작업 연결: https://learn.chatgpt.com/docs/remote-connections

## 하면 안 되는 것

- `.codex` 폴더나 `auth.json`을 USB·클라우드 드라이브로 복사하지 않습니다.
- 저장소 전체를 OneDrive에서 자동 동기화하지 않습니다. `.git` 내부가 충돌할 수 있습니다.
- GitHub에서 충돌이 났을 때 **강제 덮어쓰기**를 누르지 않습니다.
- OAuth Client Secret, Supabase `service_role` 키, Edge Function 비밀값을 GitHub에 올리지 않습니다.

충돌이나 로그인 문제가 생기면 화면을 캡처해 Codex에 보여주고, 어느 쪽 파일도 지우지 않은 채 해결합니다.
