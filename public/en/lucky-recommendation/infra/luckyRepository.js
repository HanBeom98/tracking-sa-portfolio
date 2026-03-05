export const postLuckyRecommendation = async (payload) => {
  const API_URL = "/api/lucky";

  const response = await fetch(API_URL, {
    method: "POST",
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
