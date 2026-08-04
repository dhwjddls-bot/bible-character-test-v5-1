# 원하는 URL 연결하기

현재 주소는 `https://dhwjddls-bot.github.io/`입니다. 이 주소는 GitHub 사용자 사이트의 루트 주소라 별도 경로 없이 사용할 수 있습니다. 운영 주소를 브랜드 이름으로 오래 유지하려면 본인이 소유한 도메인을 연결하는 편이 안전합니다.

## 권장 주소

- 이 서비스 전용 도메인: `www.example.com`
- 다른 홈페이지와 도메인을 함께 쓸 때: `test.example.com`

## 도메인이 정해진 뒤 할 일

1. GitHub 계정 설정에서 도메인 소유권을 TXT 레코드로 확인합니다.
2. 저장소의 Pages 설정에서 Custom domain을 입력합니다.
3. DNS에 `www` 또는 `test` CNAME을 `dhwjddls-bot.github.io`로 연결합니다.
4. 인증서가 준비되면 Enforce HTTPS를 켭니다.
5. 이 프로젝트의 `config.js`에 있는 `siteUrl`과 `index.html`의 canonical·Open Graph 주소를 새 주소로 바꿉니다.
6. Supabase Authentication의 Site URL·Redirect URL과 Google OAuth의 승인된 JavaScript 원본에 새 주소를 추가합니다.

Supabase의 Google 콜백 주소 `https://qjehpzcjeqtodlqtocir.supabase.co/auth/v1/callback`은 그대로 유지합니다.

참고 문서:

- GitHub Pages custom domain: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- GitHub 도메인 확인: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages
- Supabase 로그인 반환 주소: https://supabase.com/docs/guides/auth/redirect-urls
