// 현재 언어를 저장하는 변수 (전역에서 접근 가능하도록 let으로 선언)
let currentLang;

// 번역 맵에서 특정 키에 대한 번역을 가져오는 헬퍼 함수
window.getTranslation = function(lang, key) {
    return (translations[lang] && translations[lang][key]) ? translations[lang][key] : ''; // Return empty string if key not found
}

// 번역을 적용하는 함수
window.applyTranslations = function(lang) {
    if (document.documentElement) {
        document.documentElement.lang = lang; // Set HTML lang attribute
    }

    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        // Only update if a translation is found, otherwise keep original HTML text
        if (key && translations[lang] && translations[lang][key]) {
            element.innerHTML = translations[lang][key];
        }
    });

    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (key && translations[lang] && translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });

    const titleElement = document.querySelector('title');
    if (titleElement) {
        const key = titleElement.getAttribute('data-i18n');
        if (key && translations[lang] && translations[lang][key]) {
            titleElement.textContent = translations[lang][key];
        }
    }

    // Explicitly update the mobile menu's '테스트' button
    const mobileMenuTestButton = document.querySelector('#slide-out-menu .dropbtn');
    if (mobileMenuTestButton && mobileMenuTestButton.dataset.i18n) {
        const key = mobileMenuTestButton.dataset.i18n;
        if (key && translations[lang] && translations[lang][key]) {
            mobileMenuTestButton.textContent = translations[lang][key];
        }
    }
}

// 언어를 변경하는 함수 (전역으로 선언)
window.setLanguage = function(lang) {
    localStorage.setItem('lang', lang);
    currentLang = lang;
    const currentPath = window.location.pathname.replace(/\/index\.html$/, '/');

    const isEnPath = currentPath.includes('-en');
    const isMainPath = currentPath === '/' || /^\/page-\d+$/.test(currentPath) || currentPath.includes('index-en');

    if (lang === 'en' && isMainPath && !isEnPath) {
        let newPath = currentPath.replace(/\/page-(\d+)/, '/page-en-$1');
        if (currentPath === '/') newPath = '/index-en';
        window.location.href = newPath;
        return;
    }
    if (lang === 'ko' && isMainPath && isEnPath) {
        let newPath = currentPath.replace(/\/page-en-(\d+)/, '/page-$1').replace('/index-en', '/');
        window.location.href = newPath;
        return;
    }

    const isArticlePage = /\/\d{4}-\d{2}-\d{2}-/.test(currentPath);
    if (isArticlePage) {
        const isEnArticle = currentPath.endsWith('-en');
        if (lang === 'en' && !isEnArticle) {
            window.location.href = currentPath + '-en';
            return;
        }
        if (lang === 'ko' && isEnArticle) {
            window.location.href = currentPath.slice(0, -3);
            return;
        }
    }

    window.applyTranslations(lang);
    document.querySelectorAll('.lang-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
}

// 초기화 함수
async function initLayout() {
    // Determine current language
    let storedLang = localStorage.getItem('lang');
    if (!storedLang || !translations[storedLang]) {
        const browserLang = navigator.language.split('-')[0];
        if (translations[browserLang]) {
            currentLang = browserLang;
        } else {
            currentLang = 'ko'; // Fallback to Korean
        }
    } else {
        currentLang = storedLang;
    }
    
    // Set HTML lang attribute immediately
    if (document.documentElement) {
        document.documentElement.lang = currentLang;
    }

    // Apply translations immediately
    window.applyTranslations(currentLang);

    console.log("initLayout function executed");
    // 테마 변경 버튼에 이벤트 리스너를 추가합니다.
    const themeToggle = document.getElementById('color-change');
    const body = document.body; // body is guaranteed to exist by DOMContentLoaded

    if (body) {
        // Load theme preference from localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            body.classList.add('dark-mode');
            if (themeToggle) { // Ensure button exists before changing icon
                themeToggle.innerHTML = '☀️'; // Sun icon for dark mode
            }
        } else {
            body.classList.remove('dark-mode');
            if (themeToggle) { // Ensure button exists before changing icon
                themeToggle.innerHTML = '🌙'; // Moon icon for light mode
            }
        }
    }

    if (themeToggle && body) {
        console.log("Click event listener added to theme toggle button");
        themeToggle.addEventListener('click', () => {
            if (body) { // Defensive check for body
                body.classList.toggle('dark-mode');
                if (body.classList.contains('dark-mode')) {
                    localStorage.setItem('theme', 'dark');
                    themeToggle.innerHTML = '☀️'; // Change to sun for dark mode
                } else {
                    localStorage.setItem('theme', 'light');
                    themeToggle.innerHTML = '🌙'; // Change to moon for light mode
                }
            }
        });
    }

    // Scroll-hide/show header logic for mobile
    let lastScrollY = 0;
    const header = document.querySelector('header'); // Header is always injected by main.py
    const mediaQuery = window.matchMedia('(max-width: 768px)');

    // Define thresholds for scroll sensitivity
    const scrollUpThreshold = 60;   // Show header if scrolled up by at least 60px
    const scrollDownThreshold = 30; // Hide header if scrolled down by at least 30px
    const topOfPageThreshold = 10;  // Always show header if scrollY is less than 10px

    function handleScroll() {
        if (!header) return; // Defensive check for header
        if (mediaQuery.matches) { // Only apply on mobile
            let currentScrollY = window.scrollY;
            let scrollDifference = lastScrollY - currentScrollY; // Positive when scrolling up, negative when scrolling down

            // If at the very top of the page, always show the header
            if (currentScrollY < topOfPageThreshold) {
                header.style.transform = 'translateY(0)';
            }
            // If scrolling up significantly, show the header
            else if (scrollDifference > scrollUpThreshold) {
                header.style.transform = 'translateY(0)';
            }
            // If scrolling down significantly, hide the header
            else if (scrollDifference < -scrollDownThreshold) {
                header.style.transform = 'translateY(-100%)';
            }
            
            lastScrollY = currentScrollY;
        } else {
            // Ensure header is visible on PC if it was hidden by mobile logic
            header.style.transform = 'translateY(0)';
        }
    }

    // Add event listener when DOM is loaded
    document.addEventListener('scroll', handleScroll);

    // Also handle changes in media query (e.g., rotating device from mobile to PC)
    mediaQuery.addEventListener('change', () => {
        if (!header) return; // Defensive check for header
        if (!mediaQuery.matches) {
            header.style.transform = 'translateY(0)'; // Ensure header visible on PC
        }
    });

    // 언어 선택 버튼 추가 (language-switcher div가 있다면)
    const languageSwitcher = document.getElementById('language-switcher'); // Language switcher is always injected by main.py
    console.log("Language switcher div found:", languageSwitcher);
    if (languageSwitcher) { // Defensive check for languageSwitcher
        const createLangButton = (langCode, label) => {
            const button = document.createElement('button');
            button.textContent = label;
            button.dataset.lang = langCode;
            button.classList.add('lang-button');
            // 'active' class will be set by setLanguage call later
            button.addEventListener('click', () => {
                window.setLanguage(langCode); // Call the global function
            });
            return button;
        };

        // Clear existing content to avoid duplicates if initLayout is called multiple times
        languageSwitcher.innerHTML = '';
        languageSwitcher.appendChild(createLangButton('ko', 'KOR'));
        languageSwitcher.appendChild(createLangButton('en', 'ENG'));
        
        // Set initial active class for language buttons
        const currentActiveButton = languageSwitcher.querySelector(`.lang-button[data-lang="${currentLang}"]`);
        if (currentActiveButton) {
            currentActiveButton.classList.add('active');
        }
    }

    console.log("Translations object:", translations);

    // Mobile menu toggle logic
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const slideOutMenu = document.getElementById('slide-out-menu');
    // bodyElement is guaranteed to exist

    // Create and append overlay element
    const overlay = document.createElement('div');
    overlay.classList.add('overlay');
    document.body.appendChild(overlay); // body is guaranteed to exist

    if (mobileMenuToggle && slideOutMenu) { // Defensive check for these elements
        mobileMenuToggle.addEventListener('click', () => {
            if (body) { // Defensive check for body
                body.classList.toggle('mobile-menu-open');
            }
        });

        overlay.addEventListener('click', () => {
            if (body) { // Defensive check for body
                body.classList.remove('mobile-menu-open');
            }
        });

        // Handle clicks inside the slide-out menu
        slideOutMenu.addEventListener('click', (event) => {
            const target = event.target;

            // If a dropdown button is clicked
            if (target && target.classList.contains('dropbtn')) { // Defensive check for target
                event.preventDefault(); // Prevent default link behavior (e.g., navigating)
                event.stopPropagation(); // Stop propagation to prevent menu from closing

                const parentDropdown = target.closest('li.dropdown');
                if (parentDropdown) {
                    parentDropdown.classList.toggle('dropdown-active'); // Toggle class for CSS to show/hide dropdown content
                }
            }
            // If a link inside a dropdown or a regular navigation link is clicked
            else if (target && target.tagName === 'A') { // Defensive check for target
                // If it's a link within a dropdown, close the main menu
                // If it's a regular nav link, close the main menu
                // If it's a .dropbtn, the above if condition handles it.
                // This condition handles actual navigation links.
                if (body) { // Defensive check for body
                    body.classList.remove('mobile-menu-open');
                }
                // Also, close any open dropdowns
                slideOutMenu.querySelectorAll('li.dropdown.dropdown-active').forEach(dropdown => {
                    dropdown.classList.remove('dropdown-active');
                });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initLayout);