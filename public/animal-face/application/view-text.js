export function buildAnimalFaceViewText(translate) {
  return {
    h1: translate("animal_face_test_h1", "AI 동물상 테스트"),
    p1: translate("animal_face_test_p1", "당신은 어떤 동물을 가장 닮았나요?"),
    gender: translate("select_gender", "성별을 선택해 주세요"),
    male: translate("gender_male", "남성"),
    female: translate("gender_female", "여성"),
    uploadHint: translate("upload_hint", "여기에 사진을 드래그하거나 클릭하세요"),
    uploadBtn: translate("select_image", "이미지 선택하기"),
    analyzeBtn: translate("check_result", "나의 동물상 확인하기"),
    analyzing: translate("ai_analyzing", "AI가 당신의 얼굴을 분석 중입니다..."),
    privacy: translate("privacy_notice", "🔒 사진은 서버에 저장되지 않으니 안심하세요."),
    resultTitle: translate("analysis_result", "AI 분석 결과"),
    shareTitle: translate("share_result", "결과 공유하기"),
    download: translate("download_result", "결과 저장"),
    retake: translate("retake_test", "다시 테스트하기"),
  };
}
