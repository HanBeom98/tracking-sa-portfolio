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
            element.innerHTML = translations[lang][key];
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

    // Explicitly update the mobile menu's '테스트' button
    const mobileMenuTestButton = document.querySelector('#slide-out-menu .dropbtn');
    if (mobileMenuTestButton && mobileMenuTestButton.dataset.i18n) {
        const key = mobileMenuTestButton.dataset.i18n;
        if (translations[lang] && translations[lang][key]) {
            mobileMenuTestButton.textContent = translations[lang][key];
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
    console.log("loadLayout function executed");
    // 테마 변경 버튼에 이벤트 리스너를 추가합니다.
    const themeToggle = document.getElementById('color-change');
    console.log("Theme toggle button found:", themeToggle);
    const body = document.body;

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
            body.classList.toggle('dark-mode');
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');
                themeToggle.innerHTML = '☀️'; // Change to sun for dark mode
            } else {
                localStorage.setItem('theme', 'light');
                themeToggle.innerHTML = '🌙'; // Change to moon for light mode
            }
        });
    }

    // Scroll-hide/show header logic for mobile
    let lastScrollY = 0;
    let header = document.querySelector('header');
    const mediaQuery = window.matchMedia('(max-width: 768px)');

    // Define thresholds for scroll sensitivity
    const scrollUpThreshold = 60;   // Show header if scrolled up by at least 60px
    const scrollDownThreshold = 30; // Hide header if scrolled down by at least 30px
    const topOfPageThreshold = 10;  // Always show header if scrollY is less than 10px

    function handleScroll() {
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
        if (!mediaQuery.matches) {
            header.style.transform = 'translateY(0)'; // Ensure header visible on PC
        }
    });



    // 언어 선택 버튼 추가 (language-switcher div가 있다면)
    const languageSwitcher = document.getElementById('language-switcher');
    console.log("Language switcher div found:", languageSwitcher);
    if (languageSwitcher) {
        const createLangButton = (langCode, label) => {
            const button = document.createElement('button');
            button.textContent = label;
            button.dataset.lang = langCode;
            button.classList.add('lang-button');
            // 'active' class will be set by setLanguage call later
            button.addEventListener('click', () => {
                setLanguage(langCode);
            });
            return button;
        };

        // Clear existing content to avoid duplicates if loadLayout is called multiple times
        languageSwitcher.innerHTML = ''; 
        languageSwitcher.appendChild(createLangButton('ko', 'KOR'));
        languageSwitcher.appendChild(createLangButton('en', 'ENG'));
    }

    // 초기 로드 시 번역 적용 (언어 버튼 생성 후 호출되어야 함)
    console.log("Translations object:", translations);
    applyTranslations(currentLang);

    // Mobile menu toggle logic
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const slideOutMenu = document.getElementById('slide-out-menu');
    const bodyElement = document.body;

    // Create and append overlay element
    const overlay = document.createElement('div');
    overlay.classList.add('overlay');
    bodyElement.appendChild(overlay);

    if (mobileMenuToggle && slideOutMenu && bodyElement) {
        mobileMenuToggle.addEventListener('click', () => {
            bodyElement.classList.toggle('mobile-menu-open');
        });

        overlay.addEventListener('click', () => {
            bodyElement.classList.remove('mobile-menu-open');
        });

        // Handle clicks inside the slide-out menu
        slideOutMenu.addEventListener('click', (event) => {
            const target = event.target;

            // If a dropdown button is clicked
            if (target.classList.contains('dropbtn')) {
                event.preventDefault(); // Prevent default link behavior (e.g., navigating)
                event.stopPropagation(); // Stop propagation to prevent menu from closing

                const parentDropdown = target.closest('li.dropdown');
                if (parentDropdown) {
                    parentDropdown.classList.toggle('dropdown-active'); // Toggle class for CSS to show/hide dropdown content
                }
            } 
            // If a link inside a dropdown or a regular navigation link is clicked
            else if (target.tagName === 'A') {
                // If it's a link within a dropdown, close the main menu
                // If it's a regular nav link, close the main menu
                // If it's a .dropbtn, the above if condition handles it.
                // This condition handles actual navigation links.
                bodyElement.classList.remove('mobile-menu-open');
                // Also, close any open dropdowns
                slideOutMenu.querySelectorAll('li.dropdown.dropdown-active').forEach(dropdown => {
                    dropdown.classList.remove('dropdown-active');
                });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', loadLayout);
