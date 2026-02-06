# Project Blueprint: Modernizing `tracking-sa` Styles

## Project Overview
The `tracking-sa` project is a web application with several HTML pages, CSS styling, and JavaScript functionality. The goal is to create a visually appealing, functional, and modern web experience.

## Implemented Style, Design, and Features
-   **General Layout:** Responsive design with a sticky header, main content area, and footer.
-   **Navigation:** Desktop navigation with hover effects.
-   **Hero Banner:** Prominent hero section with action button.
-   **News Section:** Grid-based display for news cards, with distinct styling for hero cards.
-   **Dark Mode:** Basic dark mode support for various elements.
-   **Utility Controls:** Theme and language switchers in the header.
-   **AI Test Page (`ai-test.html`):** Styling for quiz-like interactive elements.
-   **Animal Face Test Page (`animal_face_test.html`):** Styling for image upload, gender selection, and prediction results.
-   **"Back to List" Button:** Redesigned button on news detail pages.
-   **SEO Enhancement:** Cleaned header, enhanced footer with sitemap/RSS links, and favicon generation logic.

## Current Task: Integrate "AI Real-time Saju Test" Feature with Cloudflare Functions for API Security

### Plan for Current Change
The user wants to add a new "AI Real-time Saju Test" feature. The key requirement is to integrate this feature securely using Cloudflare Functions to handle the Gemini API key, preventing its exposure in the browser. This involves updating navigation, creating new HTML and JavaScript files, and implementing a Cloudflare Function for API proxying.

### Detailed Steps:

#### 1. Menu and Common Elements Update (Modify `main.py`)
-   Locate the `COMMON_BODY_INJECTIONS` variable.
-   Find the "테스트" dropdown menu (`<div class="dropdown-content">`).
-   Add the new link: `<a href="/saju-test.html" data-i18n="saju_test">AI 사주 테스트</a>`.
-   Ensure existing links ("동물상 테스트", "AI 성향 테스트") remain untouched.

#### 2. Create New Page (`saju-test.html`)
-   Create a new file named `saju-test.html` in the root directory.
-   Copy the entire layout and design tone from `animal_face_test.html` as a base to ensure visual consistency.
-   **Main Area (`<main>`):**
    -   Replace image upload/prediction sections with a clean input form for:
        -   Name (text input)
        -   Birth Date (separate selectors for year, month, day - `<select>` elements)
        -   Birth Time (optional, `<select>` element for hours or text input, including "모름" (unknown) option)
        -   Gender (radio buttons or `<select>` element)
    -   Include a prominent button to trigger the Saju reading.
-   **Result Display Area (`div#result-container`):**
    -   Add this `div` to display the Saju test results.
    -   Inside it, include a placeholder for a smooth loading animation (spinner) and the message `'AI가 당신의 운명을 읽는 중입니다...'`.

#### 3. Implement Security Logic and API (Cloudflare Functions & `saju-test.js`)

##### 3.1. Create Cloudflare Function (`/functions/api/saju.js`)
-   Create a new directory `/functions/api/` in the project root.
-   Create `saju.js` inside `/functions/api/`. This file will serve as the backend proxy.
-   **Functionality:**
    -   It will receive requests from the frontend (`saju-test.js`) containing user input data.
    -   It will access the `GEMINI_API_KEY` from Cloudflare environment variables (available in Cloudflare Workers).
    -   It will construct a detailed prompt for the Gemini API using the user's input.
    -   It will make a request to the Gemini API (`gemini-2.0-flash` model).
    -   It will parse the Gemini API response and return the Saju reading to the browser.
-   **Prompt:** The function will use the following prompt: `'너는 20년 경력의 베테랑 명리학자야. 사용자의 [이름, 생년월일, 시간, 성별] 데이터를 분석해서 오늘의 총운, 재물운, 연애운을 500자 내외로 매우 상세하고 흥미진진하며 희망적으로 풀이해줘. 전문 용어를 섞어가며 신뢰감 있게 작성해줘.'`

##### 3.2. Implement Frontend Logic (`saju-test.js`)
-   Create a new file named `saju-test.js` in the root directory.
-   Implement JavaScript logic to:
    -   Collect user input from the form in `saju-test.html`.
    -   Handle the click event for the Saju reading button.
    -   **Secure API Call:** Instead of directly calling the Gemini API, send the user input data to the Cloudflare Function endpoint (`/api/saju`).
    -   Display the loading animation and message `'AI가 당신의 운명을 읽는 중입니다...'` in `div#result-container` while waiting for the response.
    -   Parse the response from `/api/saju` and display the Saju reading in `div#result-container`.
    -   **No API Key in Browser:** Ensure that no API keys are hardcoded or exposed in this frontend JavaScript file.
-   Integrate this script into `saju-test.html`.

#### 4. Update `style.css` (if necessary)
-   Review `saju-test.html`'s new form elements and loading spinner. Add any new or modified styles needed for consistent and appealing presentation that are not covered by existing styles from `animal_face_test.html`.

#### 5. Resource Check and Final Build
-   The existing logic in `main.py` for `favicon.svg` creation will ensure it's handled.
-   After all code modifications and file creations are complete, run `python main.py --build-only` from the terminal to apply changes to all generated HTML files (including `index.html`, news posts, and the new `saju-test.html`).
-   Upon successful build, commit the changes with a descriptive message and push them to the remote repository.