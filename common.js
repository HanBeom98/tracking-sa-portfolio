// 현재 언어를 저장하는 변수 (기본값은 한국어)
let currentLang = localStorage.getItem('lang') || navigator.language.split('-')[0];
if (!translations[currentLang]) {
    currentLang = 'en'; // Fallback to English if browser language is not available in translations
}

// 번역을 적용하는 함수
function applyTranslations(lang) {

    document.documentElement.lang = lang; // Set HTML lang attribute

    const elements = document.querySelectorAll('[data-i18n]');

    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            element.innerHTML = translations[lang][key]; // Changed to innerHTML


    });

    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');

    placeholders.forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[lang] && translations[lang][key]) {
            element.placeholder = translations[lang][key];


    });

    const titleElement = document.querySelector('title');
    if (titleElement) {
        const key = titleElement.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            titleElement.textContent = translations[lang][key];


    }
}

// 언어를 변경하는 함수
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyTranslations(lang);

    // Update active class on language buttons
    const langButtons = document.querySelectorAll('.lang-button');
    langButtons.forEach(button => {
        if (button.dataset.lang === lang) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// 페이지가 로드되었을 때 공통 레이아웃을 삽입하는 함수
async function loadLayout() {


    // 3. 헤더가 삽입된 후, 테마 변경 버튼에 이벤트 리스너를 추가합니다.
    const themeToggle = document.getElementById('color-change');
    const body = document.body;

    if (body) {
        // Load theme preference from localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            body.classList.add('dark-mode');
        } else {
            body.classList.remove('dark-mode');
        }
    }

    if (themeToggle && body) {



            body.classList.toggle('dark-mode');

            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');

            } else {
                localStorage.setItem('theme', 'light');

            }
        });


    // 초기 로드 시 번역 적용
    applyTranslations(currentLang);
}

// DOM이 로드되면 레이아웃을 불러옵니다.
document.addEventListener('DOMContentLoaded', loadLayout);
