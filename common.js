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
    const languageSwitcher = document.getElementById('language-switcher');
    if (languageSwitcher) {
        const createLangButton = (langCode, label) => {
            const button = document.createElement('button');
            button.textContent = label;
            button.dataset.lang = langCode;
            button.classList.add('lang-button');
            if (currentLang === langCode) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => {
                setLanguage(langCode);
                // The setLanguage function will now handle updating active classes for all buttons.
            });
            return button;
        };

        languageSwitcher.appendChild(createLangButton('ko', 'KO'));
        languageSwitcher.appendChild(createLangButton('en', 'EN'));
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
        console.log('Theme toggle button found and body exists.');
        themeToggle.addEventListener('click', () => {
            console.log('Theme toggle button clicked!');
            console.log('Before toggle body classes:', body.classList);
            body.classList.toggle('dark-mode');
            console.log('After toggle body classes:', body.classList);
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');
                console.log('Theme set to dark.');
            } else {
                localStorage.setItem('theme', 'light');
                console.log('Theme set to light.');
            }
        });
    } else {
        console.warn('Theme toggle button or body not found. themeToggle:', themeToggle, 'body:', body);
    }

    // 초기 로드 시 번역 적용
    applyTranslations(currentLang);
}

// DOM이 로드되면 레이아웃을 불러옵니다.
document.addEventListener('DOMContentLoaded', loadLayout);
