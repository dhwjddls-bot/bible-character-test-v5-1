(function () {
  const listeners = new Set();
  const config = window.APP_CONFIG || {};
  let client = null;
  let currentUser = null;
  let initialized = false;
  let initPromise = null;
  let libraryPromise = null;

  const configured = Boolean(
    config.supabaseUrl &&
    config.supabasePublishableKey &&
    /^https:\/\//.test(config.supabaseUrl)
  );

  function loadSupabaseLibrary() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("로그인 서버 연결 파일을 불러오지 못했습니다."));
      document.head.appendChild(script);
    });
    return libraryPromise;
  }

  function emit() {
    const snapshot = { configured, initialized, user: currentUser };
    listeners.forEach((listener) => {
      try { listener(snapshot); } catch (_) {}
    });
  }

  async function initialize() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!configured) {
        initialized = true;
        emit();
        return { configured, user: null };
      }

      await loadSupabaseLibrary();
      if (!window.supabase || !window.supabase.createClient) {
        throw new Error("로그인 서버 연결 파일을 사용할 수 없습니다.");
      }

      client = window.supabase.createClient(
        config.supabaseUrl,
        config.supabasePublishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      currentUser = data.session ? data.session.user : null;
      initialized = true;
      emit();

      client.auth.onAuthStateChange((_event, session) => {
        currentUser = session ? session.user : null;
        emit();
      });

      return { configured, user: currentUser };
    })().catch((error) => {
      initialized = true;
      emit();
      throw error;
    });
    return initPromise;
  }

  async function signIn(provider) {
    await initialize();
    if (!client) throw new Error("로그인 서버 설정이 아직 완료되지 않았습니다.");

    const providers = {
      google: "google",
      kakao: "kakao",
      naver: config.naverProvider || "custom:naver"
    };
    const selected = providers[provider];
    if (!selected) throw new Error("지원하지 않는 로그인 방식입니다.");

    const redirectTo = config.siteUrl || location.href.split(/[?#]/)[0];
    const { data, error } = await client.auth.signInWithOAuth({
      provider: selected,
      options: { redirectTo }
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await initialize();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  function compactResult(result) {
    const ranked = Array.isArray(result.ranked) ? result.ranked : [];
    const idOf = (entry) => entry && (entry.id || (entry.c && entry.c.id));
    const scoreOf = (entry) => Math.max(0, Math.min(100, Math.round(Number(entry && entry.score) || 0)));
    const traits = {};

    Object.entries(result.normalized || {}).forEach(([key, value]) => {
      const number = Number(value);
      if (Number.isFinite(number)) traits[key] = Math.round(number * 10) / 10;
    });

    return {
      client_result_id: result.clientResultId || (
        window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      ),
      tested_at: result.createdAt || new Date().toISOString(),
      primary_character: idOf(ranked[0]),
      primary_score: scoreOf(ranked[0]),
      second_character: idOf(ranked[1]) || null,
      second_score: ranked[1] ? scoreOf(ranked[1]) : null,
      third_character: idOf(ranked[2]) || null,
      third_score: ranked[2] ? scoreOf(ranked[2]) : null,
      trait_scores: traits,
      question_count: [16, 32, 48, 64].includes(Number(result.questionCount))
        ? Number(result.questionCount)
        : 32,
      test_mode: result.mode === "other" ? "other" : "self",
      scoring_version: result.scoringVersion || "v5.1",
      question_bank_version: result.questionBankVersion || "v5.1",
      schema_version: 1
    };
  }

  async function saveResult(result) {
    await initialize();
    if (!client || !currentUser) return { saved: false, reason: "signed-out" };

    const payload = compactResult(result);
    if (!payload.primary_character || Object.keys(payload.trait_scores).length === 0) {
      throw new Error("저장할 검사 결과가 올바르지 않습니다.");
    }

    const { data, error } = await client
      .from("test_results")
      .upsert(
        { ...payload, user_id: currentUser.id },
        { onConflict: "user_id,client_result_id", ignoreDuplicates: true }
      )
      .select("id, tested_at")
      .maybeSingle();

    if (error) throw error;
    return { saved: true, data };
  }

  async function listResults(limit = 100) {
    await initialize();
    if (!client || !currentUser) return [];

    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
    const { data, error } = await client
      .from("test_results")
      .select(
        "id,tested_at,primary_character,primary_score,second_character,second_score,third_character,third_score,trait_scores,question_count,test_mode,scoring_version,question_bank_version,schema_version"
      )
      .eq("test_mode", "self")
      .order("tested_at", { ascending: true })
      .limit(safeLimit);

    if (error) throw error;
    return data || [];
  }

  async function deleteResult(id) {
    await initialize();
    if (!client || !currentUser) return;
    const { error } = await client.from("test_results").delete().eq("id", id);
    if (error) throw error;
  }

  async function deleteAllResults() {
    await initialize();
    if (!client || !currentUser) return;
    const { error } = await client
      .from("test_results")
      .delete()
      .eq("user_id", currentUser.id);
    if (error) throw error;
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener({ configured, initialized, user: currentUser });
    return () => listeners.delete(listener);
  }

  function getDisplayName() {
    if (!currentUser) return "";
    const meta = currentUser.user_metadata || {};
    return meta.full_name || meta.name || meta.nickname || currentUser.email || "사용자";
  }

  window.AccountService = Object.freeze({
    initialize,
    signIn,
    signOut,
    saveResult,
    listResults,
    deleteResult,
    deleteAllResults,
    subscribe,
    getDisplayName,
    isConfigured: () => configured,
    getUser: () => currentUser
  });
})();
