let currentLang = localStorage.getItem('lang') || navigator.language.split('-')[0]; // Default to browser language or 'en'
// Fallback if browser language not found in translations
if (!translations[currentLang]) {
    currentLang = 'en';
}

function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang; // Set the HTML lang attribute
    localStorage.setItem('lang', lang); // Save selected language

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            // Check if the element contains strong or a tags, if so, replace innerHTML
            if (element.querySelector('strong') || element.querySelector('a')) {
                element.innerHTML = translations[currentLang][key];
            } else {
                element.textContent = translations[currentLang][key];
            }
        }
    });

    // Update active state of language buttons
    document.querySelectorAll('.lang-button').forEach(button => {
        if (button.dataset.lang === currentLang) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// 페이지가 로드되었을 때 공통 레이아웃을 삽입하는 함수
async function loadLayout() {
    // 1. 헤더 파일을 가져옵니다.
    const headerResponse = await fetch('layout/header.html');
    if (headerResponse.ok) {
        const headerHtml = await headerResponse.text();
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = headerHtml;
        }
    }

    // 2. 헤더가 삽입된 후, 테마 변경 버튼에 이벤트 리스너를 추가합니다.
    const themeToggle = document.getElementById('color-change');
    const body = document.body;

    if (themeToggle && body) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode'); // Changed to dark-mode for consistency
        });
    }

    // 3. 언어 선택 버튼에 이벤트 리스너를 추가하고 초기 언어를 설정합니다.
    document.querySelectorAll('.lang-button').forEach(button => {
        button.addEventListener('click', () => {
            setLanguage(button.dataset.lang);
        });
    });
    setLanguage(currentLang); // Apply initial translations
}

// DOM이 로드되면 레이아웃을 불러옵니다.
document.addEventListener('DOMContentLoaded', loadLayout);
