const URL = "https://teachablemachine.withgoogle.com/models/Jtg0ClWaE/"; // Replace with your Teachable Machine model URL

let model, maxPredictions;
let selectedGender = null; // To store selected gender
let imagePreview = document.getElementById("image-preview");
let currentImageFile = null;

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const imageUploadInput = document.getElementById('image-upload');
const predictButton = document.getElementById('predict-button');
const loadingIndicator = document.getElementById('loading-indicator');
const resultSection = document.getElementById('result-section');
const predictionResult = document.getElementById('prediction-result');
const confidenceScore = document.getElementById('confidence-score');
const retakeButton = document.getElementById('retake-button');
const genderSelection = document.getElementById('gender-selection');
const genderMaleButton = document.getElementById('gender-male');
const genderFemaleButton = document.getElementById('gender-female');
const shareButtonsContainer = document.getElementById('share-buttons');


async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    // Load the model
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    // Initial UI state
    hideLoadingIndicator();
    hideResultSection();
    document.querySelector('.image-upload-section').style.display = 'block'; // Show upload section

    // Event Listeners
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleFileDrop);
    imageUploadInput.addEventListener('change', handleFileSelect);
    predictButton.addEventListener('click', predict);
    retakeButton.addEventListener('click', resetUI);

    genderMaleButton.addEventListener('click', () => selectGender('male'));
    genderFemaleButton.addEventListener('click', () => selectGender('female'));

    // If an image is already present (e.g., from a previous session or if reloaded)
    if (imagePreview.src && imagePreview.src !== window.location.href) {
        document.querySelector('.image-upload-section').style.display = 'block';
    }
}

function selectGender(gender) {
    selectedGender = gender;
    // Visually update selected gender button
    genderMaleButton.classList.remove('active');
    genderFemaleButton.classList.remove('active');
    if (gender === 'male') {
        genderMaleButton.classList.add('active');
    } else {
        genderFemaleButton.classList.add('active');
    }
    console.log('Selected gender:', selectedGender);
}

function handleDragOver(event) {
    event.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
}

function handleFileDrop(event) {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.'); // Only image files
        return;
    }
    currentImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        predictButton.style.display = 'block'; // Show predict button after image is loaded
        hideResultSection();
    };
    reader.readAsDataURL(file);
}

async function predict() {
    if (!currentImageFile) {
        alert(translations[currentLang]['select_image_first'] || "먼저 이미지를 선택해주세요.");
        return;
    }

    showLoadingIndicator();
    hideResultSection();
    
    const image = imagePreview; // Use the image element for prediction
    const prediction = await model.predict(image);

    // Sort predictions by probability in descending order
    prediction.sort((a, b) => b.probability - a.probability);

    const topPrediction = prediction[0];
    const animalName = topPrediction.className;
    const confidence = (topPrediction.probability * 100).toFixed(2);

    predictionResult.textContent = animalName;
    confidenceScore.textContent = `${confidence}%`;

    hideLoadingIndicator();
    showResultSection();
    document.querySelector('.image-upload-section').style.display = 'none'; // Hide upload section
    
    // Implement share functionality here (e.g., generate image for sharing)
    setupShareButtons(animalName, confidence);
}

function showLoadingIndicator() {
    loadingIndicator.style.display = 'flex';
}

function hideLoadingIndicator() {
    loadingIndicator.style.display = 'none';
}

function showResultSection() {
    resultSection.style.display = 'block';
}

function hideResultSection() {
    resultSection.style.display = 'none';
}

function resetUI() {
    currentImageFile = null;
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    predictButton.style.display = 'none';
    predictionResult.textContent = '';
    confidenceScore.textContent = '';
    selectedGender = null;
    genderMaleButton.classList.remove('active');
    genderFemaleButton.classList.remove('active');
    hideResultSection();
    hideLoadingIndicator();
    document.querySelector('.image-upload-section').style.display = 'block'; // Show upload section
}

function setupShareButtons(animalName, confidence) {
    // Example: Generate a simple text for sharing
    const shareText = `저는 ${animalName}상 입니다! (${confidence}% 확률) #동물상테스트`;
    const shareUrl = window.location.href; // URL of the current page

    // Twitter Share
    const twitterButton = shareButtonsContainer.querySelector('[data-platform="twitter"]');
    if (twitterButton) {
        twitterButton.onclick = () => {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        };
    }

    // Facebook Share
    const facebookButton = shareButtonsContainer.querySelector('[data-platform="facebook"]');
    if (facebookButton) {
        facebookButton.onclick = () => {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank');
        };
    }

    // Download Result (simple download of the current image preview)
    const downloadButton = shareButtonsContainer.querySelector('[data-platform="download"]');
    if (downloadButton) {
        downloadButton.onclick = () => {
            if (imagePreview.src && imagePreview.src.startsWith('data:image')) {
                const link = document.createElement('a');
                link.href = imagePreview.src;
                link.download = `animal_face_test_result_${animalName}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert('다운로드할 이미지가 없습니다.');
            }
        };
    }
}


document.addEventListener("DOMContentLoaded", init);
