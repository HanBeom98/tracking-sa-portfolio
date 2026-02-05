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
*   **Responsive...
<truncated>
