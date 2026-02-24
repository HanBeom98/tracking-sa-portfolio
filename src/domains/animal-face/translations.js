// translations.js
// Dummy translations file
const translations = {
    "en": {
        "welcome": "Welcome to Tracking SA",
        "news": "News",
        "fortune": "Fortune",
        "animal_face_test": "Animal Face Test"
    },
    "ko": {
        "welcome": "Tracking SA에 오신 것을 환영합니다",
        "news": "뉴스",
        "fortune": "운세",
        "animal_face_test": "동물 얼굴 테스트"
    }
};

function translate(key, language = "en") {
    return translations[language][key] || key;
}