# 로그인·검사 기록 설정

사이트의 검사 기능은 설정 없이도 동작합니다. Google·Naver·Kakao 로그인과 서버 기록은 아래 설정을 마치면 활성화됩니다.

## 구조

- 인증·데이터베이스: Supabase
- Google 로그인: Supabase 기본 Google 공급자
- Kakao 로그인: Supabase 기본 Kakao 공급자
- Naver 로그인: Supabase Custom OAuth 공급자 + `naver-userinfo` Edge Function
- 웹 호스팅: 기존 GitHub Pages
- 브라우저에 공개되는 값: Supabase 프로젝트 URL과 Publishable Key만 사용
- 브라우저에 두지 않는 값: 모든 Client Secret, service_role 키

검사 원문 답변과 타인 테스트의 이름·관계는 서버에 저장하지 않습니다. 자기분석용 기록에는 검사 날짜, 상위 인물 3명, 점수, 12개 성향 점수, 문항 수만 저장합니다.

## 1. Supabase 프로젝트

1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다.
   - 12인 버전의 테이블을 이미 만든 프로젝트는 대신 `supabase/migrations/20260804_expand_character_catalog.sql`을 한 번 실행해 100인 결과 저장을 허용합니다.
3. Authentication > URL Configuration에서 다음 값을 등록합니다.
   - Site URL: `https://dhwjddls-bot.github.io/bible-character-test-v5-1/`
   - Redirect URL: `https://dhwjddls-bot.github.io/bible-character-test-v5-1/`
4. Project Settings > API의 Project URL과 Publishable Key를 `config.js`에 입력합니다.
5. `service_role` 키는 웹 파일이나 GitHub에 넣지 않습니다.

## 2. Google

1. Google Auth Platform에서 웹 OAuth 클라이언트를 만듭니다.
2. JavaScript origin에 `https://dhwjddls-bot.github.io`를 등록합니다.
3. Redirect URI에는 Supabase Google 공급자 화면에 표시된 Callback URL을 등록합니다.
4. Client ID와 Client Secret을 Supabase Authentication > Providers > Google에만 입력합니다.

## 3. Kakao

1. Kakao Developers에서 앱을 만들고 Kakao Login과 OpenID Connect를 활성화합니다.
2. Redirect URI에는 Supabase Kakao 공급자 화면의 Callback URL을 등록합니다.
3. REST API Key와 Client Secret을 Supabase Authentication > Providers > Kakao에만 입력합니다.
4. 닉네임과 이메일은 서비스에 꼭 필요한 범위만 동의 항목으로 설정합니다.

## 4. Naver

1. Supabase CLI로 `naver-userinfo` 함수를 JWT 검증 없이 배포합니다. 이 함수는 전달받은 Naver 토큰을 Naver 프로필 API에서 확인하며 토큰을 저장하지 않습니다.
2. Naver Developers에서 웹 애플리케이션을 만들고, Supabase Custom OAuth 화면에 표시되는 Callback URL을 등록합니다.
3. Supabase Authentication > Providers > Custom Providers에서 OAuth2 공급자를 만듭니다.
   - Identifier: `custom:naver`
   - Authorization URL: `https://nid.naver.com/oauth2.0/authorize`
   - Token URL: `https://nid.naver.com/oauth2.0/token`
   - UserInfo URL: 배포된 `naver-userinfo` 함수 URL
   - PKCE: Naver 앱 설정과 실제 로그인 시험 결과에 맞춰 설정
   - Email optional: 켬
4. Naver Client ID와 Client Secret은 이 Custom Provider 설정에만 입력합니다.

## 5. 출시 전 확인

- 세 공급자 모두 실제 계정으로 로그인·로그아웃·재로그인을 시험합니다.
- 한 계정으로 저장한 결과가 다른 계정에 보이지 않는지 확인합니다.
- 공유 링크에는 원문 답변, 이메일, 타인 이름이 들어가지 않는지 확인합니다.
- 개인정보처리방침에 로그인 공급자, 저장 항목, 보유 기간, 삭제 방법을 반영합니다.
- 청소년이 사용하는 서비스라면 운영 국가와 연령대에 맞는 동의 절차를 별도로 검토합니다.
