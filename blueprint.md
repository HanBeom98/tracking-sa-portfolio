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
-   **"Back to List" Button:** Redesigned button on news detail pages.

## Current Task: SEO Enhancement and Header Cleanup (Focus on `main.py` common elements)

### Plan for Current Change
The user wants to improve SEO and clean up header code by modifying common element variables directly within `main.py`. This involves removing duplicate meta tags, enhancing footer navigation, and ensuring favicon availability. AdSense and Clarity scripts must be preserved.

### Detailed Steps:

#### 1. Header Cleanup (`COMMON_HEAD_SCRIPTS` in `main.py`)
-   **Identify Duplicate `google-site-verification`:** Inspect `COMMON_HEAD_SCRIPTS` within `main.py`. If the `<meta name="google-site-verification" ... />` tag appears more than once, remove the duplicates, leaving only one instance. (Initial analysis of `COMMON_HEAD_SCRIPTS` shows only one instance, but a careful check will be performed again.)
-   **Preserve Critical Scripts:** Explicitly ensure that AdSense (`adsbygoogle.js`), Clarity (`clarity.ms`), Firebase, and other common JS/CSS links are not removed or modified.

#### 2. Footer Link Enhancement (`COMMON_FOOTER` in `main.py`)
-   Locate the `COMMON_FOOTER` variable in `main.py`.
-   Add two new links next to "개인정보처리방침" (Privacy Policy) using the existing `|` separator style:
    -   `<a href="/sitemap.xml">사이트맵</a>`
    -   `<a href="/rss.xml">RSS Feed</a>`

#### 3. Resource Check and Creation (Favicon)
-   **Check `favicon.svg`:** Before copying assets, check if `favicon.svg` exists in the project's root directory.
-   **Extract SVG Logo:** If `favicon.svg` is missing, extract the entire `<svg> ... </svg>` code block from the `COMMON_BODY_INJECTIONS` variable in `main.py`.
-   **Create `favicon.svg`:** Create a new file named `favicon.svg` in the root directory and populate it with the extracted SVG logo code. This step will be integrated into the `copy_static_assets` function or executed before `generate_public_site` to ensure it's available for copying.

#### 4. Build and Reflect
-   After all code modifications are complete, run `python main.py --build-only` from the terminal to apply changes to all generated HTML files (including `index.html` and news posts).
-   Upon successful build, commit the changes with a descriptive message and push them to the remote repository.
