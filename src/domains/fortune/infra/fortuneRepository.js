export function createFortuneRepository() {
  const API_URL = "/api/fortune";

  async function fetchFortune(payload) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
