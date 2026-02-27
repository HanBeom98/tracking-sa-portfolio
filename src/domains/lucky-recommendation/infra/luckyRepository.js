export const postLuckyRecommendation = async (payload) => {
  const response = await fetch("https://tracking-sa.vercel.app/api/lucky", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("LUCKY_API_FAILED");
  }

  return response.json();
};
