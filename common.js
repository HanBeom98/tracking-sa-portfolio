// 현재 언어를 저장하는 변수
let currentLang;

// 번역 적용 함수
window.applyTranslations = function(lang) {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key && translations[lang] && translations[lang][key]) {
            element.innerHTML = translations[lang][key];
        }
    });
    
    const titleElement = document.querySelector('title');
    if (titleElement && translations[lang] && translations[lang]['news_home']) {
        titleElement.textContent = translations[lang]['news_home'] + " - Tracking SA";
    }
}

// 언어 변경 함수
window.setLanguage = function(lang) {
    localStorage.setItem('lang', lang);
    location.reload(); // 복잡한 로직 대신 깔끔하게 새로고침으로 해결
}

// 레이아웃 초기화 (헤더 숨기기 로직 완전 제거)
async function initLayout() {
    let storedLang = localStorage.getItem('lang') || 'ko';
    currentLang = storedLang;
    window.applyTranslations(currentLang);

    const themeToggle = document.getElementById('color-change');
    const body = document.body;

    // 테마 로드
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        if (themeToggle) themeToggle.innerHTML = '🌙';
    } else {
        body.classList.remove('dark-mode');
        if (themeToggle) themeToggle.innerHTML = '☀️';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggle.innerHTML = isDark ? '🌙' : '☀️';
        });
    }

    // 언어 스위처 생성
    const switcher = document.getElementById('language-switcher');
    if (switcher) {
        switcher.innerHTML = `
            <button class="lang-button ${currentLang==='ko'?'active':''}" onclick="setLanguage('ko')">KOR</button>
            <button class="lang-button ${currentLang==='en'?'active':''}" onclick="setLanguage('en')">ENG</button>
        `;
    }
    
    // 헤더 노출 강제 보장
    const header = document.querySelector('header');
    if (header) {
        header.style.display = 'flex';
        header.style.visibility = 'visible';
        header.style.opacity = '1';
    }
}

document.addEventListener('DOMContentLoaded', initLayout);
