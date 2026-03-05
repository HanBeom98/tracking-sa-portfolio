export function createFortuneRepository() {
  // Cloudflare Functions와의 충돌을 피하기 위해 Vercel API 주소를 직접 호출합니다.
  const API_URL = "https://tracking-sa.vercel.app/api/fortune";

  async function fetchFortune(payload) {
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "cors", // CORS 명시
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      throw new Error("TOO_MANY_REQUESTS");
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error("FORTUNE_API_FAILED");
    }

    return data;
  }

  return { fetchFortune };
}
