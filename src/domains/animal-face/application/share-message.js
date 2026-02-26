function buildAnimalFaceShareText(result) {
  if (!result) return "";
  return `저는 ${result.name} 입니다! (${result.score}% 확률) #동물상테스트 #TrackingSA`;
}

function buildAnimalFaceShareUrl(platform, text, pageUrl) {
  const encodedText = encodeURIComponent(text || "");
  const encodedUrl = encodeURIComponent(pageUrl || "");
  if (platform === "twitter") {
    return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
  }
  if (platform === "facebook") {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
  }
  return "";
}

export {
  buildAnimalFaceShareText,
  buildAnimalFaceShareUrl,
};
