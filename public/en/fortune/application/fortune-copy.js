export function resolveFortuneLanguage() {
  return localStorage.getItem("lang") || "ko";
}

export function createFortuneCopy(translate) {
  return {
    name: translate("name", "이름"),
    birth: translate("birthdate_label", "생년월일"),
    gender: translate("gender_select_label", "성별"),
    male: translate("gender_male", "남성"),
    female: translate("gender_female", "여성"),
    check: translate("get_saju_reading", "운세 확인하기"),
    loading: translate("ai_reading_fortune", "AI가 당신의 운세를 읽는 중입니다..."),
    loadingSub: translate("saju_loading_sub", "기운의 흐름과 오늘의 핵심 신호를 분석 중입니다."),
    placeholder: translate("name_placeholder", "이름을 입력하세요"),
    inputMissing: translate("saju_input_missing", "이름, 생년월일, 성별 정보를 모두 입력해주세요."),
    apiError: translate("saju_api_error", "운세 확인 실패. 잠시 후 다시 시도해주세요."),
    tooManyRequests: translate(
      "saju_too_many_requests",
      "AI 요청량이 일시적으로 초과되었습니다. 약 1분 후 다시 시도해주세요.",
    ),
  };
}
