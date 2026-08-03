window.APP_CONFIG = Object.freeze({
  // 브라우저에 공개해도 되는 Supabase 연결값만 사용합니다.
  // service_role, Secret Key, OAuth Client Secret은 이 파일에 넣지 않습니다.
  supabaseUrl: "https://qjehpzcjeqtodlqtocir.supabase.co",
  supabasePublishableKey: "sb_publishable_EU2-jVeWXkobKFZVd4q13Q_y7IgHV_4",
  // 설정이 끝난 로그인 제공자만 화면에 노출합니다.
  enabledAuthProviders: ["google"],
  naverProvider: "custom:naver",
  siteUrl: "https://dhwjddls-bot.github.io/bible-character-test-v5-1/"
});
