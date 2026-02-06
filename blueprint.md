# Project Blueprint: Modernizing `tracking-sa` Styles

## Project Overview
The `tracking-sa` project is a web application with several HTML pages, CSS styling, and JavaScript functionality. The goal is to create a visually appealing, functional, and modern web experience.

## Implemented Style, Design, and Features (Initial Version)
-   **General Layout:** Responsive design with a sticky header, main content area, and footer.
-   **Navigation:** Desktop navigation with hover effects.
-   **Hero Banner:** Prominent hero section with action button.
-   **News Section:** Grid-based display for news cards, with distinct styling for hero cards.
-   **Dark Mode:** Basic dark mode support for various elements.
-   **Utility Controls:** Theme and language switchers in the header.
-   **AI Test Page (`ai-test.html`):** Styling for quiz-like interactive elements.
-   **Animal Face Test Page (`animal_face_test.html`):** Styling for image upload, gender selection, and prediction results.

## Current Task: Redesign "Back to List" Button on News Detail Page

### Plan for Current Change
The user wants to visually upgrade the "Back to list" button on the news detail page with a trendy design. This involves modifying the HTML structure in `main.py` to include an icon and updating `style.css` with new styles for appearance, shape, animations, and dark mode compatibility, all while maintaining existing layout and menu structure.

### Detailed Steps:

#### 1. HTML Structure Change (in `main.py`)
-   Locate the code responsible for generating the news detail page, specifically the "Back to list" link.
-   Modify the link to use the following structure: `<a href="/" class="back-to-list"><i class="fas fa-arrow-left"></i> 목록으로 돌아가기</a>`.
-   **Pre-check for Font Awesome:** Before using `<i>` tags with `fas fa-arrow-left`, I need to verify if Font Awesome is already included in `index.html` or a similar base template, or if it needs to be added (e.g., via CDN). Assuming it's available for now based on common patterns.

#### 2. Style Update (in `style.css`)
-   Create or update the `.back-to-list` CSS class.
-   **Basic Design:**
    -   `background-color: transparent;`
    -   `border: 1px solid rgba(0, 82, 204, 0.1);` (light blue border)
    -   `color: #0052cc;` (main blue text)
-   **Shape & Padding:**
    -   `border-radius: 50px;` (fully rounded)
    -   `padding: 10px 20px;`
-   **Animation:**
    -   `transition: all 0.3s ease;` (smooth transition)
    -   On hover (`.back-to-list:hover`):
        -   `background-color: rgba(0, 82, 204, 0.1);` (fill with light blue)
        -   `transform: translateX(-3px);` (move slightly left)
-   **Display:** Ensure it's displayed as an inline-block or block element to allow padding and margin to apply correctly (e.g., `display: inline-flex; align-items: center; gap: 8px;`).

#### 3. Placement Adjustment (in `style.css`)
-   Add `margin-top: 30px;` to `.back-to-list` to provide sufficient spacing from the content above.
-   **Dark Mode Compatibility:** Add a dark mode rule for `.back-to-list` to ensure `color: #60a5fa;` (bright blue) when `body.dark-mode` is active.

#### 4. Finalization
-   After all code modifications are complete, run `python main.py --build-only` to ensure the changes are reflected and the site builds successfully.
-   Upon successful build, commit the changes with a descriptive message and push them to the remote repository.