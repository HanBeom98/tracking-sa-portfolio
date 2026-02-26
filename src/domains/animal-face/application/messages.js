function interpolate(template, values) {
  return Object.entries(values).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }, template);
}

export function createAnimalFaceMessages(translate) {
  return {
    modelLoading: () =>
      translate(
        "animal_face_model_loading",
        "AI model is still loading. Please try again in a moment.",
      ),
    analysisError: () =>
      translate(
        "animal_face_analysis_error",
        "An error occurred while analyzing your image.",
      ),
    scoreLabel: (score) =>
      interpolate(
        translate("ai_matching_rate", "AI analysis result shows {confidence}% matching rate."),
        { confidence: score },
      ),
  };
}
