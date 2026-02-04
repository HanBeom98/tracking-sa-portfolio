# AI Model Personality Test Integration

This blueprint details the integration of a "Which AI Model Are You Most Like?" personality test into the Tracking-SA web project. The integration includes creating a new dedicated test page, updating the main navigation, and removing the promotional banner from the home screen for a cleaner layout.

## Project Overview

The Tracking-SA project is a framework-less web application (HTML, CSS, JavaScript) focusing on news and insights related to AI and technology. It features dark mode and language switching.

## Detailed Outline of Implemented Features

### 1. New Test Page: `ai-test.html`

*   **Topic:** "나와 가장 닮은 인공지능 모델은?" (Which AI Model Are You Most Like?)
*   **Target AI Models:** ChatGPT (Logic/Efficiency), Claude (Emotion/Detail), Gemini (Creativity/Multitasking), Perplexity (Fact-checking/Exploration).
*   **Quiz Logic:**
    *   Consists of 5 multiple-choice questions, each with 4 options.
    *   Each option is associated with a score for one of the four AI models.
    *   Scores are aggregated based on user selections.
    *   The AI model with the highest accumulated score is determined as the "most alike."
    *   Tie-breaking: Currently, the first AI model encountered with the highest score wins in case of a tie.
*   **Design:**
    *   Utilizes the main site's green color (`#22c55e`) for buttons and accents.
    *   Styled with standard CSS to maintain consistency with `style.css`.
    *   Result screen displays the winning AI model's emoji, name, and a descriptive sentence.
*   **Functionality:**
    *   "Start Test" button initiates the quiz.
    *   "Next" button progresses through questions after an answer is selected.
    *   "Copy Result Link" button copies the URL, which includes the test result as a query parameter (`?result=ai_model_name`), allowing users to share their specific result.
    *   "Retake Test" button resets the quiz.
*   **Responsiveness:** Designed to be fully responsive for mobile and desktop screens.
*   **Dark Mode:** Styles adapted for dark mode.
*   **Header Consistency:** The header in `ai-test.html` matches the consolidated header structure in `index.html`, including the '테스트' dropdown menu.

### 2. Navigation Update: `index.html`

*   **Header Structure Integrated**: The `index.html` file now contains only one `<header>` element with a green background (`#22c55e`). This header includes the main navigation bar and the utility buttons (only language selection remains).
*   **Menu Order and Composition**: The main navigation menu items are now ordered as:
    *   홈 (`index.html`)
    *   테스트 (Dropdown parent for "동물상 테스트" and "AI 성향 테스트")
    *   파트너십 문의 (`inquiry.html`)
    *   회사 소개 (`about.html`)
    *   문의 (`contact.html`)
    *   개인정보처리방침 (`privacy-policy.html`)
*   **"뉴스 홈" Removed**: The "뉴스 홈" link has been removed from the navigation.
*   **"테스트" Dropdown Position**: The "테스트" dropdown menu effectively replaces the original "동물상 테스트" button's position.
*   **Dropdown Menu Implementation**:
    *   This dropdown, on hover, reveals "동물상 테스트" (Animal Face Test) and "AI 성향 테스트" (AI Tendency Test) as sub-menu links.
*   The links within the dropdown point to `animal_face_test.html` and `ai-test.html` respectively.

### 3. Homepage Clean-up: `index.html`

*   **Promotional Banner Removed**: The `<section class="hero-banner">` has been completely removed from `index.html`.
*   The home screen (`index.html`) now displays only the consolidated header menu and the latest news list, providing a clean and professional look without any AI test promotional banners.

### 4. Translation Support: `translations.js`

*   New translation keys (`ai_tendency_test`, `hero_title`, `hero_subtitle`, `start_test_button`) have been added to `translations.js` for both Korean (`ko`) and English (`en`) languages to ensure multi-language support for the new features.

## Plan and Steps for Current Requested Change

All requested changes have been implemented in the following files:

1.  **`main.py`**: The `COMMON_BODY_INJECTIONS` constant has been updated to inject the correct, single-line header with the new menu structure and dropdown, and without the `#color-change` button.
2.  **`ai-test.html`**:
    *   Created the new HTML structure for the quiz.
    *   Updated its header to match the new dropdown navigation for consistency.
3.  **`ai-test.js`**: Implemented the core JavaScript logic for the quiz.
4.  **`style.css`**: Completely rewritten and refined to:
    *   Restore core styling for the entire site (header, layout, news cards, dark mode).
    *   Correctly integrate styles for `ai-test.html`.
    *   Set header background to green (`#22c55e`), with horizontal menu and white text.
    *   Remove all CSS associated with the deleted `#color-change` moon icon button.
    *   Configure main container for `max-width: 1200px` and `margin: auto`.
    *   Style news cards with white background, soft shadow, rounded corners, and grid layout.
    *   Define dark mode styles for body background and card colors.
    *   **Removed `.hero-banner` related CSS.**
    *   **Applied `position: sticky; top: 0; z-index: 1000;` to the main `header` for a fixed-on-scroll effect.**
    *   Removed `flex-wrap: wrap;` from `header` and `nav ul` in `style.css` to prevent the menu from splitting into two lines.
    *   Added robust styles for the new dropdown menu (hide by default, show on hover, white background, black text, soft shadow, correct positioning).
    *   Removed any potential redundant header-related CSS, ensuring a clean and unified stylesheet.
5.  **`index.html`**:
    *   Consolidated to a single `<header>` element with the main navigation bar and utility buttons (only language switcher remains).
    *   Removed the "뉴스 홈" link.
    *   Removed the `#color-change` moon icon button.
    *   The `nav ul` has been reconstructed to follow the exact order `[홈 / 테스트(드롭다운) / 파트너십 문의 / 회사 소개 / 문의 / 개인정보처리방침]`.
    *   **The `<section class="hero-banner">` has been completely removed.**
    *   The home screen now shows only the menu bar and the news list.
6.  **`translations.js`**: New translation keys for the AI test and hero banner content have been added.

**Final Check Summary:**
*   **Home screen cleanliness:** `index.html` displays a single, integrated green menu bar with the specified order and a functioning '테스트' dropdown. The page is free of any AI test promotional banners, showing only the menu and the news list.
*   **'테스트' menu dropdown:** Hovering over '테스트' correctly displays the sub-menus ('동물상 테스트', 'AI 성향 테스트') with the correct styling.
*   **Utility buttons:** Only the language selection button remains on the right end of the header and remains functional. The theme change button and its icon are gone.
*   **'AI 성향 테스트' redirection:** The 'AI 성향 테스트' link within the dropdown successfully navigates to the independent `ai-test.html` page where the quiz resides.
*   **Sticky Header:** The main header bar is fixed at the top during scrolling.
