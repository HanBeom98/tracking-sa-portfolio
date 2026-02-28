/**
 * Shared Common Translations
 * Loaded on every page via /translations.js
 */
const translations = {
    'ko': {
        'home': '홈',
        'menu_community': '커뮤니티',
        'menu_board': '게시판',
        'menu_chart': '차트',
        'menu_test': '테스트',
        'menu_game': '게임',
        'about_us': '서비스 소개',
        'contact': '문의',
        'privacy_policy': '개인정보처리방침',
        'theme_change': '테마 변경',
        'login': '로그인',
        'logout': '로그아웃',
        'signup': '회원가입',
        'close': '닫기',
        'logged_in': '로그인됨',
        'auth_google_login': 'Google로 로그인',
        'auth_email_login': '로그인',
        'account_title': '내 정보',
        'footer_copyright': '&copy; 2026 TrackingSA. 전문 기술 인사이트 & AI 서비스 허브.',
        'search_placeholder': '관심 있는 기술이나 통찰 검색...',
        'search_button': '검색',
        'search_results_title': '검색 결과'
    },
    'en': {
        'home': 'Home',
        'menu_community': 'Community',
        'menu_board': 'Board',
        'menu_chart': 'Charts',
        'menu_test': 'Tests',
        'menu_game': 'Games',
        'about_us': 'About Us',
        'contact': 'Contact',
        'privacy_policy': 'Privacy Policy',
        'theme_change': 'Theme',
        'login': 'Log in',
        'logout': 'Log out',
        'signup': 'Sign up',
        'close': 'Close',
        'account_title': 'Account',
        'footer_copyright': '&copy; 2026 TrackingSA. Tech Insights & AI Hub.',
        'search_placeholder': 'Search for tech insights...',
        'search_button': 'Search',
        'search_results_title': 'Search Results'
    }
};

if (typeof window !== "undefined") {
    window.translations = translations;
}
