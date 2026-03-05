export function resolveLuckyLanguage() {
  return localStorage.getItem("lang") || "ko";
}

export function createLuckyCopy(translate) {
  return {
    name: translate("name_label", "이름"),
    birth: translate("lucky_birth_md_label", "생일(월/일)"),
    gender: translate("gender_label", "성별"),
    male: translate("gender_male", "남성"),
    female: translate("gender_female", "여성"),
    check: translate("lucky_check_button", "행운의 추천 받기"),
    placeholder: translate("name_placeholder", "이름을 입력하세요"),
    loadingTitle: translate("lucky_loading_title", "AI가 오늘의 행운 추천을 찾고 있습니다..."),
    loadingSub: translate("lucky_loading_sub", "오늘의 기운, 컬러 신호, 추천 아이템을 분석 중입니다."),
    luckyColor: translate("lucky_color_label", "오늘의 행운 컬러"),
    luckyItem: translate("lucky_item_label", "오늘의 행운 아이템"),
    errorMessage: translate("lucky_error", "행운 분석에 실패했습니다."),
    monthSuffix: translate("month_suffix", "월"),
    daySuffix: translate("day_suffix", "일"),
  };
}
