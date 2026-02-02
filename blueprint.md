# AI Development Guidelines for Modern Web Projects in Firebase Studio

## Project Overview

This project is a framework-less web application designed to demonstrate modern web development practices within the Firebase Studio environment. It utilizes HTML, CSS, and JavaScript, focusing on efficiency, responsiveness, and user experience.

## Current Features

### Animal Face Test

This feature allows users to perform an "animal face test" by uploading an image. It uses a pre-trained Teachable Machine image classification model to process the uploaded image and displays the prediction (dog or cat) with a probability score.

*   **Technology:** HTML, CSS, JavaScript, TensorFlow.js, Teachable Machine Image model.
*   **Model URL:** `https://teachablemachine.withgoogle.com/models/5FtcgpOmH/`
*   **User Interaction:**
    *   An input field allows users to select an image file.
    *   An image preview displays the selected image.
    *   A "Predict" button initiates the model prediction.
    *   Prediction results (class name and probability) are shown below the image.

## Plan for Current Request: Change to Image Upload

The user has requested to change the implementation from using a live webcam feed to allowing users to upload an image file for classification.

### Steps:

1.  **Modify `animal_face_test.html`:**
    *   Remove the webcam initialization and prediction loop. (Completed)
    *   Add an `<input type="file">` element for image selection. (Completed)
    *   Add an `<img>` element to serve as a preview for the uploaded image. (Completed)
    *   Add a "Predict" button to trigger the classification. (Completed)
2.  **Update JavaScript Logic:**
    *   Create a new `init()` function that only loads the Teachable Machine model. (Completed)
    *   Implement a function to handle the file input change event. This function will read the selected file, display it in the `<img>` preview element. (Completed)
    *   Create a new `predict()` function that takes the `<img>` element as input and runs the model classification. This function will be called when the "Predict" button is clicked. (Completed)
3.  **Refine UI/UX:** Adjust the layout and styling to accommodate the new elements (file input, image preview, button). (Completed)
4.  **Verify Functionality:** Test the page to ensure that a user can upload an image, see a preview, click the button, and receive a correct prediction. (Next Step)