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
    -   **Translation Update for H1:** The Korean phrase "당신은 어떤 동물을 닮았나요?" in the `animal_face_test.html` page has been translated to "Which animal do you resemble?" in English.
    -   **Result Text Modification:** The result text "Your animal is" has been updated to "The animal that resembles you is {emoji}" to provide a more descriptive output including the predicted animal's emoji.
    -   **AI Matching Rate Translation:** The AI matching rate text ("AI 분석 결과 ~%의 매칭률을 보입니다.") is now translated using a new translation key `ai_matching_rate` in `translations.js` and dynamically integrated into `main.js`.
    -   **Script Loading Order Correction:** The `animal_face_test.html` now correctly loads all necessary scripts (TensorFlow, Teachable Machine, translations.js, common.js) within the `<head>` section via dynamic injection by `main.py`, ensuring proper global scope access for `main.js`. `main.js` is conditionally injected into the `<body>` for this specific page.
    -   **Redundant Emoji Removal:** The separate large emoji (`resultEmoji` element) is now cleared (`resultEmoji.innerHTML = ''`) since the emoji is now directly part of the `predictionResult` text.
    -   **"당신과 닮은" Translation Issue Resolved:** The "당신과 닮은" phrase now correctly translates based on the selected language. The issue was resolved by ensuring the latest version of `translations.js` was loaded by the browser, likely resolving a caching issue.
-   **"Back to List" Button:** Redesigned button on news detail pages.
-   **SEO Enhancement:** Cleaned header, enhanced footer with sitemap/RSS links, and favicon generation logic.
-   **Firebase Integration:** Added Firebase server configurations to `.idx/mcp.json` as required for the Firebase Studio environment.

## Current Task: Implement Multi-Agent AI System

### System Overview
A Node.js-based system for orchestrating multiple AI agents to collaboratively complete complex tasks. The system is designed with a clear separation of concerns, making it modular and extensible.

### Core Architecture
-   **Orchestrator:** The central component (`orchestrator.js`) that manages the workflow. It initializes a `state` object and calls a sequence of agents (`Planner` -> `Developer` -> `Reviewer`), passing the state between them.
-   **Agents:** Specialized functions in `agents.js` that perform specific tasks.
-   **State Object:** A JavaScript object that acts as a shared memory or context for the agents. It holds the initial request, intermediate results (plan, code), and the final output.
-   **Prompt Management:** Agent personas and instructions are stored in a separate `prompts.js` file. For agents requiring structured output, prompts include explicit instructions to return JSON.

### Implemented Components (`multi-agent-system/`)
-   **`index.js`:** The main entry point to trigger a test run of the system.
-   **`orchestrator.js`:** Implements the main orchestration logic.
-   **`agents.js`:** Implements the agent runners. After debugging, this was refactored to bypass the `@google/generative-ai` SDK and use direct `fetch` calls to the Gemini v1 REST API. This was the key to resolving persistent `404 Not Found` errors.
-   **`prompts.js`:** Exports a configuration object for agent personas and instructions.

### API & Model Configuration
-   **Method:** Direct `fetch` calls to the Gemini REST API.
-   **Endpoint Version:** `v1`
-   **Model:** `gemini-2.0-flash` (as identified from the working `fortune` service).
-   **Dependencies:** `dotenv` for API key management. The `@google/generative-ai` SDK was removed.

### Current Status
Completed and operational. The system successfully connects to the Gemini API and executes a full workflow, demonstrating that the orchestration, state management, and API integration are working correctly.

- [2026-02-22 12:29:21] Feature updated: tetris-game (Request: folder: tetris-game 생성. 기존 웹사이트의 헤더/푸터 레이아웃을 유지하면서...)
- [2026-02-22 13:00:11] Feature updated: tetris-game (Request: folder: tetris-game의 빌드 오류 수정. main.py의 빌드 프로세스가 t...)- [2026-02-22 13:05:11] Feature updated: tetris-game (Optimized: scroll prevention and responsive UI fitting)
