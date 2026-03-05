export const postLuckyRecommendation = async (payload) => {
  // 전역 설정을 통해 API 엔드포인트를 가져옵니다.
  const API_URL = (window.runtimeConfig && window.runtimeConfig.luckyApi)
    ? window.runtimeConfig.luckyApi
    : "https://tracking-sa.vercel.app/api/lucky";

  const response = await fetch(API_URL, {
    method: "POST",
    mode: "cors",
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
