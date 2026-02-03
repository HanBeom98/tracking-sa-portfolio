// 현재 언어를 저장하는 변수 (기본값은 한국어)
let currentLang = localStorage.getItem('lang') || 'ko';

// 번역을 적용하는 함수
function applyTranslations(lang) {
    document.documentElement.lang = lang; // Set HTML lang attribute

    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[lang] && translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });

    const titleElement = document.querySelector('title');
    if (titleElement) {
        const key = titleElement.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            titleElement.textContent = translations[lang][key];
        }
    }
}

// 언어를 변경하는 함수
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyTranslations(lang);
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

    // 2. 언어 선택 버튼 추가
    const languageSelectorPlaceholder = document.getElementById('language-selector-placeholder');
    if (languageSelectorPlaceholder) {
        const langSelect = document.createElement('select');
        langSelect.id = 'language-selector';
        langSelect.innerHTML = `
            <option value="ko">한국어</option>
            <option value="en">English</option>
        `;
        langSelect.value = currentLang; // Set selected language
        langSelect.addEventListener('change', (event) => {
            setLanguage(event.target.value);
        });
        languageSelectorPlaceholder.appendChild(langSelect);
    }

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
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');
            } else {
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // 초기 로드 시 번역 적용
    applyTranslations(currentLang);
}

// DOM이 로드되면 레이아웃을 불러옵니다.
document.addEventListener('DOMContentLoaded', loadLayout);
