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

### 2. Navigation Update: `index.html`

*   A new navigation link, "AI 성향 테스트" (AI Tendency Test), has been added to the main header navigation bar.
*   Positioned directly after the "동물상 테스트" link.
*   The link points to `ai-test.html`.

### 3. Homepage Hero Banner: `index.html`

*   A prominent horizontal banner has been added above the "최신 뉴스" section on the `index.html` homepage.
*   **Headline:** "나와 가장 닮은 인공지능 모델은? 🤖" (Which AI Model Are You Most Like? 🤖) (large font).
*   **Sub-headline:** "간단한 테스트로 나의 AI 성향을 알아보세요!" (Find out your AI personality with a simple test!)
*   **Call-to-Action Button:** "테스트 시작하기" (Start Test), which links to `ai-test.html`.
*   **Styling:**
    *   Light green gradient background.
    *   Rounded corners (`border-radius: 15px`).
    *   Soft shadow (`box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1)`).
    *   Designed to harmonise with existing news cards and overall site aesthetic.
*   **Responsiveness:** Fully responsive, adjusting gracefully to different screen sizes.
*   **Dark Mode:** Styles adapted for dark mode.

### 4. Translation Support: `translations.js`

*   New translation keys (`ai_tendency_test`, `hero_title`, `hero_subtitle`, `start_test_button`) have been added to `translations.js` for both Korean (`ko`) and English (`en`) languages to ensure multi-language support for the new features.

## Plan and Steps for Current Requested Change

All requested changes have been implemented in the following files:

1.  **`ai-test.html`**: Created the new HTML structure for the quiz.
2.  **`ai-test.js`**: Implemented the core JavaScript logic for the quiz.
3.  **`style.css`**: Added all necessary CSS for `ai-test.html` and the `.hero-banner` to maintain visual consistency and responsiveness, including dark mode support. Also, corrected a previous duplication error.
4.  **`index.html`**:
    *   Inserted the `<header>` element with the main navigation bar.
    *   Added the new "AI 성향 테스트" link to the navigation.
    *   Inserted the hero banner section.
5.  **`translations.js`**: Added new translation keys for the AI test and hero banner content.