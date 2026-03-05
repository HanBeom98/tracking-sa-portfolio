export const postLuckyRecommendation = async (payload) => {
  // Cloudflare Functions와의 충돌을 피하기 위해 Vercel API 주소를 직접 호출합니다.
  const API_URL = "https://tracking-sa.vercel.app/api/lucky";

  const response = await fetch(API_URL, {
    method: "POST",
    mode: "cors", // CORS 명시
    headers: { 
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("LUCKY_API_FAILED");
  }

  return response.json();
};
