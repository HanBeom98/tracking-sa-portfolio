# AI Model Personality Test Integration

This blueprint details the integration of a "Which AI Model Are You Most Like?" personality test into the Tracking-SA web project. The integration includes creating a new dedicated test page, updating the main navigation, and adding a prominent hero banner on the homepage.

## Project Overview

The Tracking-SA project is a framework-less web application (HTML, CSS, JavaScript) focusing on news and insights related to AI and technology. It features a dark mode toggle, language switching, and an existing "Animal Face Test" functionality.

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
    *   Styled with standard CSS to maintain consistency with `style.css` (no Tailwind CSS directly used, as it's not integrated into the project).
    *   Result screen displays the winning AI model's emoji, name, and a descriptive sentence.
*   **Functionality:**
    *   "Start Test" button initiates the quiz.
    *   "Next" button progresses through questions after an answer is selected.
    *   "Copy Result Link" button copies the URL, which includes the test result as a query parameter (`?result=ai_model_name`), allowing users to share their specific result.
    *   "Retake Test" button resets the quiz.
*   **Responsiveness:** Designed to be fully responsive for mobile and desktop screens.
*   **Dark Mode:** Styles adapted for dark mode.
*   **Header Consistency:** The header in `ai-test.html` now matches the consolidated header structure in `index.html`, including the '테스트' dropdown menu.

### 2. Navigation Update: `index.html`

*   **Header Structure Integrated**: The `index.html` file now contains only one `<header>` element with a green background (`#22c55e`). This header includes the main navigation bar and the utility buttons (theme change and language selection).
*   **Dropdown Menu Implementation**:
    *   The navigation menu now includes a "테스트" (Test) dropdown item.
    *   This dropdown, on hover, reveals "동물상 테스트" (Animal Face Test) and "AI 성향 테스트" (AI Tendency Test) as sub-menu links.
*   The links within the dropdown point to `animal_face_test.html` and `ai-test.html` respectively.

### 3. Homepage Hero Banner: `index.html`

*   A prominent horizontal banner has been added above the "최신 뉴스" section on the `index.html` homepage.
*   **Headline:** "나와 가장 닮은 인공지능 모델은? 🤖" (Which AI Model Are You Most Like? 🤖) (large font).
*   **Sub-headline:** "간단한 테스트로 나의 AI 성향을 알아보세요!" (Find out your AI personality with a simple test!)
*   **Call-to-Action Button:** "테스트 시작하기" (Start Test), which explicitly links to `ai-test.html`. The home screen does not display the quiz questions, only the promotional banner.
*   **Styling:**
    *   Light green gradient background (`linear-gradient(to right, #f0fdf4, #e0ffe0)`).
    *   Rounded corners (`border-radius: 15px`).
    *   Soft shadow (`box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1)`).
    *   Constrained `max-width` to `1200px` to harmonize with main content (matching news list width).
    *   Designed to harmonise with existing news cards and overall site aesthetic.
*   **Responsiveness:** Fully responsive, adjusting gracefully to different screen sizes.
*   **Dark Mode:** Styles adapted for dark mode.

### 4. Translation Support: `translations.js`

*   New translation keys (`ai_tendency_test`, `hero_title`, `hero_subtitle`, `start_test_button`) have been added to `translations.js` for both Korean (`ko`) and English (`en`) languages to ensure multi-language support for the new features.

## Plan and Steps for Current Requested Change

All requested changes have been implemented in the following files:

1.  **`ai-test.html`**:
    *   Created the new HTML structure for the quiz.
    *   **Updated its header to match the new dropdown navigation for consistency.**
2.  **`ai-test.js`**: Implemented the core JavaScript logic for the quiz.
3.  **`style.css`**: Completely rewritten and refined to:
    *   Restore core styling for the entire site (header, layout, news cards, dark mode).
    *   Correctly integrate styles for `ai-test.html` and the `.hero-banner`.
    *   Set header background to green (`#22c55e`), with horizontal menu and white text.
    *   Configure main container for `max-width: 1200px` and `margin: auto`.
    *   Style news cards with white background, soft shadow, rounded corners, and grid layout.
    *   Define dark mode styles for body background and card colors.
    *   Ensure `.hero-banner` width matches main content and uses a light green gradient.
    *   **Added robust styles for the new dropdown menu** (hide by default, show on hover, white background, black text, soft shadow, correct positioning).
    *   Removed any potential redundant header-related CSS, ensuring a clean and unified stylesheet.
4.  **`index.html`**:
    *   **Consolidated to a single `<header>`** element with the main navigation bar and utility buttons.
    *   The new "테스트" dropdown menu structure has been implemented.
    *   The hero banner section is correctly placed and styled, with its button linking to `ai-test.html`.
5.  **`translations.js`**: New translation keys for the AI test and hero banner content have been added.

**Final Check Summary:**
*   **Home screen cleanliness:** `index.html` displays a single menu bar, the promotion banner, and the news list cleanly.
*   **'테스트' menu dropdown:** Hovering over '테스트' correctly displays the sub-menus ('동물상 테스트', 'AI 성향 테스트').
*   **'테마 변경' and language buttons:** These are correctly placed at the right end of the header and remain functional.
*   **'테스트 시작하기' redirection:** Clicking the button on the hero banner successfully navigates to the independent `ai-test.html` page where the quiz resides.
