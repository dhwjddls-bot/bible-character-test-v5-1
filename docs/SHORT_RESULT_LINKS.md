# 짧은 결과 링크 설정

짧은 링크는 `https://사이트주소/?r=7K3P2A`처럼 6자리 코드만 브라우저 주소에 남깁니다. 실제 결과는 Supabase의 `shared_results` 테이블에 90일 동안 유효한 형태로 저장합니다.

## 저장하는 정보

- 상위 인물 3명의 내부 ID와 0~100점 점수
- 선택 사항인 발견 인물 1명의 내부 ID와 점수
- 문항 수, 채점 버전, 문항 버전
- 6자리 코드, 생성 시각, 만료 시각

이름, 이메일, 회원 ID, 질문별 답변, 12개 성향 점수, 타인 검사에서 입력한 이름·관계는 요청 본문에 넣을 수 없고 데이터베이스에도 저장하지 않습니다. API는 정해진 키 외의 필드가 하나라도 있으면 요청 전체를 거부합니다.

## 1. 데이터베이스 준비

새 프로젝트는 먼저 `supabase/schema.sql`을 실행한 다음 아래 마이그레이션을 실행합니다. 기존 12인 데이터베이스라면 `202608040000_expand_character_catalog.sql`을 먼저 실행하고, 이미 100인 목록까지 확장한 운영 프로젝트라면 아래 파일만 한 번 실행합니다.

```text
supabase/migrations/202608040001_create_shared_results.sql
```

마이그레이션은 다음 보안 규칙을 함께 만듭니다.

- `shared_results`와 요청 제한 테이블의 브라우저 직접 접근 차단
- Edge Function에서만 호출할 수 있는 생성·조회 데이터베이스 함수
- 인물 ID, 점수 범위, 순위, 문항 수, 현재 지원 버전의 데이터베이스 재검증
- `0`, `1`, `I`, `O`를 제외한 읽기 쉬운 6자리 코드와 충돌 시 재발급
- 생성은 같은 네트워크 기준 10분에 120회, 조회는 1분에 120회로 제한
- 결과는 생성 후 90일이 지나면 조회 불가

## 2. Edge Function 비밀값

Supabase Dashboard의 Edge Function Secrets에 다음 값을 등록합니다.

```text
SHARE_RATE_LIMIT_SECRET=예측할_수_없는_32바이트_이상의_임의_문자열
SHARE_ALLOWED_ORIGINS=https://dhwjddls-bot.github.io
```

- `SHARE_RATE_LIMIT_SECRET`은 공개 저장소, 웹 코드, `config.js`에 넣지 않습니다.
- `SHARE_ALLOWED_ORIGINS`에는 경로가 아닌 출처(origin)만 쉼표로 구분해 넣습니다. 현재 GitHub Pages의 `/bible-character-test-v5-1/` 경로와 루트 경로는 모두 같은 `https://dhwjddls-bot.github.io` 출처입니다.
- 로컬 시험이 필요하면 시험할 때만 `http://localhost:포트`를 추가합니다. `*`와 `null` 출처는 허용하지 않습니다.
- `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 호스팅된 Edge Function에 기본 제공됩니다. `service_role` 키를 별도 웹 파일에 복사하지 않습니다.

`SHARE_RATE_LIMIT_SECRET`은 원본 IP 주소를 저장하지 않고 HMAC-SHA-256 요청 제한 키를 만드는 데만 사용합니다. 데이터베이스에는 되돌릴 수 없는 64자리 해시와 짧은 만료 시각만 남습니다.

## 3. 함수 배포

함수 이름은 `shared-result`입니다. `supabase/config.toml`에 공개 호출 설정이 들어 있으므로 해당 설정을 사용해 배포합니다. 로그인하지 않은 방문자도 결과를 공유하고 열 수 있어야 하므로 이 함수는 JWT를 요구하지 않습니다. 대신 CORS 허용 목록, 엄격한 입력 검사, 본문 2KB 제한, 데이터베이스 요청 제한을 적용합니다.

이 저장소에서는 배포를 자동 실행하지 않습니다. 운영자가 마이그레이션과 비밀값을 확인한 뒤 Supabase Dashboard 또는 CLI에서 배포해야 합니다.

## 4. API 계약

함수 주소:

```text
https://PROJECT_REF.supabase.co/functions/v1/shared-result
```

결과 생성:

```http
POST /functions/v1/shared-result
Content-Type: application/json

{
  "payload": {
    "v": 2,
    "s": "v5.2-100",
    "b": "v5.1",
    "q": 32,
    "r": [["david", 88], ["moses", 81], ["joseph", 77]],
    "d": ["esther", 75]
  }
}
```

현재는 `s`에 `v5.2-100`, `b`에 `v5.1`만 허용합니다. `b`를 생략하면 `v5.1`로 저장하고, `d`는 생략하거나 `null`로 보낼 수 있습니다. 다음 채점 버전을 출시할 때는 Edge Function과 데이터베이스 허용 목록을 함께 갱신합니다.

```json
{
  "code": "7K3P2A",
  "expiresAt": "2026-11-02T08:00:00.000Z"
}
```

결과 조회:

```http
GET /functions/v1/shared-result?code=7K3P2A
```

```json
{
  "payload": {
    "v": 2,
    "s": "v5.2-100",
    "b": "v5.1",
    "q": 32,
    "r": [["david", 88], ["moses", 81], ["joseph", 77]],
    "d": ["esther", 75]
  },
  "expiresAt": "2026-11-02T08:00:00.000Z"
}
```

주요 오류는 `400 invalid_payload/invalid_code`, `403 origin_not_allowed`, `404 not_found`, `413 payload_too_large`, `429 rate_limited`, `503 service_unavailable`입니다. `429` 응답에는 `Retry-After` 헤더와 초 단위 `retryAfter` 값이 함께 옵니다.

## 5. 운영 점검

- 허용한 실제 사이트에서는 생성과 조회가 되고, 다른 웹 출처에서는 `403`인지 확인합니다.
- 요청 JSON에 `name`, `email`, `answers` 같은 필드를 추가했을 때 `400`인지 확인합니다.
- 데이터베이스의 `shared_results`를 Publishable Key로 직접 조회·삽입할 수 없는지 확인합니다.
- 같은 네트워크에서 생성 제한을 넘겼을 때 `429`와 `Retry-After`가 오는지 확인합니다.
- 존재하지 않거나 만료된 정상 형식 코드는 `404`, 형식이 잘못된 코드는 `400`이며 사이트 화면에서는 모두 안전하게 시작 화면으로 돌아가는지 확인합니다.
- 로그에 요청 본문, 원본 IP, 관리자 키를 추가로 출력하지 않습니다.

만료 시각이 지난 결과는 즉시 조회되지 않으며, 조회 시 또는 새 링크 생성 중 확률적 정리로 삭제됩니다. 법적·운영상 정확히 90일 뒤 물리 삭제가 필요하면 Supabase Cron에서 매일 `expires_at <= now()` 행을 삭제하는 작업을 별도로 설정합니다.

참고: [Supabase Edge Function CORS](https://supabase.com/docs/guides/functions/cors), [Edge Function 비밀값](https://supabase.com/docs/guides/functions/secrets), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
