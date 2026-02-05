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

### 5. Mobile Responsiveness & Hamburger Menu

*   **`style.css` Modifications**:
    *   Restored `header` background-color to brand green (`#22c55e`) and `color` to `white` for desktop.
    *   Restored `nav a` and `nav ul li.dropdown .dropbtn` `color` to `white`.
    *   Restored `body.dark-mode header` `background-color` to `#1c923f` (darker green).
    *   Moved "테스트" button 3 pixels up using `transform: translateY(-3px)` on `.dropbtn`.
    *   Added comprehensive mobile-specific responsive overrides within `@media (max-width: 768px)`:
        *   `header`: Flex direction changed to column, items centered, background color set to brand green.
        *   `.header-content`: New flex container to manage site title and hamburger toggle.
        *   `.site-logo`: White text on green background.
        *   `.hamburger-menu-toggle`: Displayed on mobile, white icon.
        *   `.desktop-menu-container`: Hidden by default, slides down when opened, green background for menu items.
        *   `nav ul`, `nav a`, `nav ul li.dropdown .dropbtn`: Flex direction changed to column, items centered, white text on green menu background.
        *   `.utility-controls`: Centered, white background and green text for language buttons.
        *   News grid and hero card adjustments (single column layout) are maintained.
*   **`common.js` Modifications**:
    *   Implemented JavaScript logic to toggle the `menu-open` class on `.desktop-menu-container` when `.hamburger-menu-toggle` is clicked, providing the hamburger menu functionality.

### 6. Utility Buttons Position

*   **`main.py` Modifications**:
    *   The `COMMON_BODY_INJECTIONS` constant was updated to wrap the theme change button and language switcher in a new `div` with the class `utility-controls`.
*   **`style.css` Modifications**:
    *   The `.utility-buttons` class and its styles were replaced with a new `.utility-controls` class. This new class uses `display: flex; gap: 10px; align-items: center; margin-left: auto;` to position the utility buttons to the top right of the header for desktop views.
    *   The mobile responsive styles within `@media (max-width: 768px)` were also updated to target `.utility-controls`.

## Resolved Issues & Further Actions:

*   **Deployment Blockage**: Resolved by removing `public/` from `.gitignore` and modifying the GitHub Actions workflow (`.github/workflows/daily-news-post.yml`) to use `git add .` for comprehensive staging of all generated files.
*   **Header Duplication/Inconsistency**: Resolved by:
    *   Updating `main.py`'s `COMMON_BODY_INJECTIONS` constant with the correct single-line header structure, menu order, and dropdown, and without the theme change button.
    *   Enhancing `process_html_file_for_common_elements` in `main.py` to robustly remove any existing `<header>` tags from HTML files before injecting the new header.
    *   Refining `style.css` to ensure single-line header display by removing `flex-wrap: wrap;` from `header` and `nav ul` rules, applying `position: sticky`, and cleaning up all unused styling.
*   **Python Dependencies**: Ensured `main.py` runs correctly by explicitly executing it with the virtual environment's Python interpreter, resolving `ModuleNotFoundError`.
*   **AI Test Page Deployment**: Confirmed `ai-test.html` and `ai-test.js` are included in the `assets` list within `main.py`'s `copy_static_assets` function, ensuring their proper copying to the `public/` directory.

---
**Final Check Summary:**
*   **Home screen cleanliness:** `index.html` displays a single, integrated green menu bar with the specified order and a functioning '테스트' dropdown. The page is free of any AI test promotional banners, showing only the menu and the news list.
*   **'테스트' menu dropdown:** Hovering over '테스트' correctly displays the sub-menus ('동물상 테스트', 'AI 성향 테스트') with the correct styling.
*   **Utility buttons:** The language selection button and theme change button are correctly positioned to the top right of the header for desktop views and centered on mobile. They remain functional.
*   **'AI 성향 테스트' redirection:** The 'AI 성향 테스트' link within the dropdown successfully navigates to the independent `ai-test.html` page where the quiz resides.
*   **Sticky Header:** The main header bar is fixed at the top during scrolling.
*   **Mobile UI Fixes**: The mobile header background is brand green, the hamburger menu functions correctly, menu items are vertically and centrally aligned with proper spacing, and news content does not overlap with the header. The hero/grid layout and card visual details are responsive and correct.
*   **News Update**: The site should now correctly update news and reflect all changes upon deployment via GitHub Actions.
