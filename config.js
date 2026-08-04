window.APP_CONFIG = Object.freeze({
  // 브라우저에 공개해도 되는 Supabase 연결값만 사용합니다.
  // service_role, Secret Key, OAuth Client Secret은 이 파일에 넣지 않습니다.
  supabaseUrl: "https://qjehpzcjeqtodlqtocir.supabase.co",
  supabasePublishableKey: "sb_publishable_EU2-jVeWXkobKFZVd4q13Q_y7IgHV_4",
  // 설정이 끝난 로그인 제공자만 화면에 노출합니다.
  enabledAuthProviders: ["google"],
  naverProvider: "custom:naver",
  // Kakao JavaScript 키는 브라우저용 공개 키입니다. Admin 키나 Client Secret은 넣지 않습니다.
  kakaoJavaScriptKey: "8d06efc3736e9ab0a574fc5fb77bc120",
  shortResultEndpoint: "https://qjehpzcjeqtodlqtocir.supabase.co/functions/v1/shared-result",
  siteUrl: "https://dhwjddls-bot.github.io/"
});
