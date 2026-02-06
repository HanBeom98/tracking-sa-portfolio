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

## Current Task: Apply Trendy Design System (Visual Elements Only)

### Plan for Current Change
The user wants to apply a modern, trendy design system to the `style.css` file. Crucially, the existing layout (positions, menu structure) must remain untouched. Only visual elements like colors, gradients, shapes, shadows, and animations are to be modified.

### Detailed Steps:

#### 1. Colors and Gradients
-   **`body` background:** Change to a soft sky gradient: `linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)`.
-   **`header` background:** Apply a deep premium blue gradient: `linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)`.

#### 2. Shape and Depth
-   **Rounded Corners:** Set `border-radius` to `20px` for `.hero-banner`, `.news-card`, and `.hero-card`.
-   **Subtle Shadows:** Apply `box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1)` to `.hero-banner`, `.news-card`, and `.hero-card` for a sophisticated, diffused look.

#### 3. Smooth Animations (Micro-interactions)
-   **Smooth Transitions:** Apply `transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1)` to all buttons and cards (any elements with `cursor: pointer` or explicit `transition` properties) for a "쫀득한" (chewy/elastic) animation feel.
-   **Floating Hover Effect:** For `.news-card:hover` and `.hero-card:hover`, add `transform: translateY(-8px)` to create a floating effect when moused over. Ensure existing hover effects are merged or overridden correctly.

#### 4. Hero Banner Pulse Effect
-   Implement a subtle pulsing animation for the `.hero-banner` background. This will involve defining `@keyframes` for a slight scale/opacity change and applying it to a pseudo-element or the background itself to ensure it doesn't affect the content.

#### 5. Finalization
-   After all CSS modifications are complete, run `python main.py --build-only` to ensure the changes are reflected and the site builds successfully.
-   Upon successful build, commit the changes with a descriptive message and push them to the remote repository.
