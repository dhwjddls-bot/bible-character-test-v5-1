# 성경인물 성향 테스트 작업 인수인계

마지막 정리일: 2026-08-13

현재 제품 표기: V5.3.1

작업 기준 브랜치: `main`

이 문서는 회사·집 등 다른 컴퓨터와 새 Codex 대화에서 작업을 이어가기 위한 기준 문서입니다. 새 작업을 시작할 때 `README.md`, `AGENTS.md`와 함께 먼저 읽고, 의미 있는 변경을 마칠 때 현재 상태와 다음 작업을 갱신합니다.

## 주소와 저장소

- 공개 사이트: https://dhwjddls-bot.github.io/
- 소스 저장소: https://github.com/dhwjddls-bot/bible-character-test-v5-1
- 공개 사이트 저장소: https://github.com/dhwjddls-bot/dhwjddls-bot.github.io
- Supabase 프로젝트 ref: `qjehpzcjeqtodlqtocir`

소스 저장소의 `main`을 개발 기준으로 사용합니다. 공개 배포가 필요한 변경은 검증한 뒤 공개 사이트 저장소의 `main`에도 같은 커밋을 반영합니다.

## 현재 구현 상태

- 빌드가 필요 없는 정적 HTML·CSS·JavaScript 웹앱
- 16·32·48·64문항, 약 10%의 3지선다
- 나·타인 테스트, 100명의 성경인물 매칭
- 결과 전체 긴 이미지 저장, 일반 공유, 6자리 짧은 결과 링크, 카카오톡 공유
- 문항 진행 중 이전 문항 이동과 답변 변경
- Google 로그인과 개인별 검사 기록·시간선 분석
- Naver·Kakao 로그인 코드는 준비되어 있으나 `config.js`에서는 아직 비활성화
- 채점 버전 `v5.2-100`, 질문은행 버전 `v5.1`

## 외부 서비스와 보안

- Supabase URL·Publishable Key와 Kakao JavaScript Key는 브라우저 공개용 값입니다.
- OAuth Client Secret, Supabase `service_role` 키, Edge Function 비밀값은 각 서비스 대시보드에만 보관합니다.
- `.codex` 폴더나 `auth.json`은 컴퓨터 사이에 복사하거나 GitHub에 올리지 않습니다.
- 원문 답변, 이메일, 타인 테스트의 이름·관계는 공유 링크에 넣거나 서버에 저장하지 않습니다.
- Google·Supabase·Kakao·Naver·GitHub는 모두 운영자의 개인 계정을 기준으로 유지합니다.

## 파일 안내

- `app.js`: 검사 진행, 결과, 저장, 공유와 카카오 SDK
- `account.js`: Supabase 로그인과 검사 기록
- `history.js`: 시간선·변화 분석
- `data/questions.js`: 질문과 선택지
- `data/scoring.js`: 균형 출제와 100인 채점
- `data/characters*.js`: 인물 설명과 프로필
- `supabase/`: 데이터베이스 마이그레이션과 Edge Functions
- `docs/ACCOUNT_SETUP.md`: 소셜 로그인 설정
- `docs/SHORT_RESULT_LINKS.md`: 짧은 결과 주소 설정
- `docs/WORKING_ACROSS_COMPUTERS.md`: 회사·집을 오가는 작업 방법
- `assets/app-icon-*.png`: 앱 아이콘 원본과 후보안. 반려된 램프 시안은 저장소에서 제외함

## 다음 작업 우선순위

1. 모바일 카카오톡 결과 공유 흐름 재현·수정
   - 첨부 화면의 `apps.kakao.com`은 결과 페이지가 아니라 카카오톡 공유 메시지 수신 설정 화면으로 보임.
   - 카카오 Developers에서 `https://dhwjddls-bot.github.io`가 JavaScript SDK 도메인과 제품 링크 웹 도메인 양쪽에 등록됐는지 확인.
   - 실제 공유 말풍선의 이미지·`결과 자세히 보기` 버튼과 하단 앱 출처 영역을 구분해 재현.
   - 필요하면 결과 링크와 SDK를 미리 준비하고 클릭 시 `sendDefault`를 즉시 호출하거나 `createDefaultButton` 방식으로 변경.
2. `assets/app-icon-master.png` 또는 최종 후보를 favicon·PWA 아이콘으로 실제 적용.
3. Naver·Kakao 로그인 활성화 전 실제 계정으로 로그인·로그아웃·재로그인 검증.
4. 질문 표현과 100인 결과 데이터의 지속적인 국문·성경 본문 검수.

## 집 컴퓨터에서 처음 시작할 때

1. 개인 ChatGPT 계정으로 데스크톱 앱에 로그인합니다.
2. GitHub Desktop에서 소스 저장소를 복제합니다.
3. 복제한 폴더를 ChatGPT 데스크톱 앱의 로컬 프로젝트로 엽니다.
4. 첫 메시지로 아래처럼 요청합니다.

> AGENTS.md, HANDOFF.md, README.md와 최근 Git 기록을 확인하고 현재 작업을 이어서 진행해줘. 수정 전 원격 최신 상태와 로컬 변경부터 확인해줘.

5. 공개 배포도 할 컴퓨터라면 Codex에 공개 사이트 저장소를 `root-pages` 원격으로 연결해 달라고 요청합니다. 이 원격 연결은 복제할 때 자동으로 따라오지 않습니다.

Supabase 명령이 필요한 작업을 할 때만 개인 Supabase 계정으로 다시 로그인하고 프로젝트를 연결합니다. 평소 HTML·CSS·JavaScript 수정과 테스트에는 Supabase CLI 로그인이 필요하지 않습니다.

## 작업을 마칠 때

- 관련 테스트를 실행합니다.
- 변경 내용과 다음 할 일을 이 문서에 반영합니다.
- 소스 저장소 `main`에 커밋·푸시합니다.
- 공개 배포를 요청받았다면 공개 사이트 저장소 `main`에도 같은 커밋을 푸시하고 실제 사이트를 확인합니다.
- 다른 컴퓨터에서 작업 중이었다면 그쪽 작업을 끝내기 전까지 동시에 수정하지 않습니다.
