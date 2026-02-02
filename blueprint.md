# AI Development Guidelines for Modern Web Projects in Firebase Studio

## Project Overview

This project is a framework-less web application demonstrating modern web development practices within the Firebase Studio environment. It utilizes HTML, CSS, and JavaScript for the frontend, with a Python Flask backend (`app.py`) to serve dynamic content. The project focuses on efficiency, responsiveness, and user experience, now featuring an automated news publishing system.

## Current Features

### 1. Automated News Publishing and Display System

This system automatically generates news articles using the Gemini AI, saves them as Markdown files, and pushes them to a Git repository, triggering a Cloudflare deployment. The generated news is then displayed on the website's homepage.

*   **Technologies:** Python (`main.py` for generation/Git integration, `app.py` for Flask backend), HTML, CSS, JavaScript (Web Components, Marked.js for Markdown rendering).
*   **Backend (`app.py`):**
    *   Serves static frontend files (HTML, CSS, JS).
    *   Provides `/api/news` endpoint to list available Markdown news articles with metadata (title, date, ID).
    *   Provides `/api/news/<article_id>` endpoint to retrieve the content of a specific Markdown article.
*   **Frontend (HTML, JS Web Components):**
    *   `index.html`: Serves as the news homepage, embedding the `<news-app>` Web Component.
    *   `news-app.js`: Main application logic for the news section, handles client-side routing (using URL hash) between the news list and individual articles.
    *   `news-list.js`: Web Component that fetches news metadata from `/api/news` and renders a clickable list of articles.
    *   `news-article.js`: Web Component that fetches a specific article's content from `/api/news/<article_id>`, uses `marked.js` to render Markdown to HTML, and displays the article.
*   **Automated Content Generation (`main.py`):**
    *   Fetches latest AI news from an RSS feed (e.g., TechCrunch).
    *   Uses Gemini AI (`gemini-flash-latest`) to generate a detailed Markdown post based on the fetched news.
    *   Saves the generated post to the `posts/` directory.
    *   Automatically performs `git add`, `git commit`, and `git push` to integrate new content into the deployment pipeline.

### 2. Animal Face Test

This feature allows users to perform an "animal face test" by uploading an image. It uses a pre-trained Teachable Machine image classification model to process the uploaded image and displays the prediction (dog or cat) with a probability score.

*   **Technology:** HTML, CSS, JavaScript, TensorFlow.js, Teachable Machine Image model.
*   **User Interaction:**
    *   Accessed via a dedicated navigation link.
    *   An input field allows users to select an image file.
    *   An image preview displays the selected image.
    *   A "Predict" button initiates the model prediction.
    *   Prediction results (class name and probability) are shown below the image.

## Plan for Current Request: Update blueprint.md

The user has requested to update the blueprint.md file to accurately reflect the current state of the project after implementing the news display on the homepage and ensuring the animal face test is accessible via navigation.

### Steps:

1.  **Rewrite `blueprint.md`:** Replace outdated content with a comprehensive description of the current features, technologies, and architecture, as outlined in the "Current Features" section above.
2.  **Ensure accuracy:** Verify that the updated blueprint accurately reflects all implemented changes.
