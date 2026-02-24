const URL = "https://teachablemachine.withgoogle.com/models/e52yfi_eK/"; // Updated Teachable Machine model URL

// Mapping of animal names to emojis with Korean names. Keys match AI model's class names.
const animalData = {
    '강아지': { emoji: '🐶', kor: '강아지상' },
    '고양이': { emoji: '🐱', kor: '고양이상' },
    '다람쥐': { emoji: '🐿️', kor: '다람쥐상' },
    '곰': { emoji: '🐻', kor: '곰상' },
    '토끼': { emoji: '🐰', kor: '토끼상' },
    '여우': { emoji: '🦊', kor: '여우상' }
};

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
const resultEmoji = document.getElementById('result-emoji'); 
const predictionResult = document.getElementById('prediction-result');
const confidenceScore = document.getElementById('confidence-score');
const retakeButton = document.getElementById('retake-button');
const genderSelection = document.getElementById('gender-selection');
const genderMaleButton = document.getElementById('gender-male');
const genderFemaleButton = document.getElementById('gender-female');
const shareButtonsContainer = document.getElementById('share-buttons');
const imagePreviewContainer = document.getElementById('image-preview-container');


async function init() {
    showLoadingIndicator("모델 로딩 중..."); 
    
    predictButton.disabled = true;
    dropZone.style.pointerEvents = 'none'; 
    genderMaleButton.disabled = true;
    genderFemaleButton.disabled = true;

    const timestamp = new Date().getTime();
    const modelURL = URL + "model.json?v=" + timestamp;
    const metadataURL = URL + "metadata.json?v=" + timestamp;

    try {
        model = await window.tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        predictButton.disabled = false;
        dropZone.style.pointerEvents = 'auto'; 
        genderMaleButton.disabled = false;
        genderFemaleButton.disabled = false;

        hideLoadingIndicator();
        hideResultSection();
        dropZone.style.display = 'block'; 
        imagePreviewContainer.style.display = 'none'; 

    } catch (error) {
        console.error("Error loading the model:", error);
        alert("AI 모델 로딩에 실패했습니다. 페이지를 새로고침 해주세요.");
        hideLoadingIndicator();
    }

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleFileDrop);
    imageUploadInput.addEventListener('change', handleFileSelect);
    predictButton.addEventListener('click', predict);
    retakeButton.addEventListener('click', resetUI);

    genderMaleButton.addEventListener('click', () => selectGender('male'));
    genderFemaleButton.addEventListener('click', () => selectGender('female'));

    if (imagePreview.src && imagePreview.src !== window.location.href) {
        document.querySelector('.image-upload-section').style.display = 'block';
    }
}

function selectGender(gender) {
    selectedGender = gender;
    genderMaleButton.classList.remove('active');
    genderFemaleButton.classList.remove('active');
    if (gender === 'male') {
        genderMaleButton.classList.add('active');
    } else {
        genderFemaleButton.classList.add('active');
    }
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
        const msg = (window.getTranslation && window.getTranslation(window.currentLang, 'only_image_files_alert')) || "이미지 파일만 업로드할 수 있습니다.";
        alert(msg);
        return;
    }
    currentImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        predictButton.style.display = 'block'; 
        hideResultSection();
        dropZone.style.display = 'none';
        imagePreviewContainer.style.display = 'block';
        imagePreview.style.display = 'block'; 
        predictButton.style.display = 'block'; 
    };
    reader.readAsDataURL(file);
}

async function predict() {
    if (!model) {
        alert("AI 모델이 아직 로딩 중입니다. 잠시만 기다려 주세요.");
        return;
    }

    if (!currentImageFile) {
        const msg = (window.getTranslation && window.getTranslation(window.currentLang, 'select_image_first')) || "이미지를 먼저 선택해주세요.";
        alert(msg);
        return;
    }

    showLoadingIndicator();
    hideResultSection();
    
    const image = imagePreview; 
    const prediction = await model.predict(image);

    prediction.sort((a, b) => b.probability - a.probability);

    const topPrediction = prediction[0];
    const rawName = topPrediction.className.trim(); 
    const confidence = (topPrediction.probability * 100).toFixed(2);

    const animalInfo = animalData[rawName];

    if (animalInfo) {
        resultEmoji.innerHTML = ''; 
        predictionResult.innerText = window.getTranslation(window.currentLang, 'your_animal_face_is') + " " + animalInfo.emoji;
        setupShareButtons(animalInfo.kor, confidence); 
    } else {
        resultEmoji.innerHTML = ''; 
        predictionResult.innerText = window.getTranslation(window.currentLang, 'your_animal_face_is') + " " + '❓';
        setupShareButtons(rawName, confidence); 
    }
    
    const rateMsg = (window.getTranslation && window.getTranslation(window.currentLang, 'ai_matching_rate')) || "AI 분석 결과 {confidence}%의 매칭률을 보입니다.";
    confidenceScore.innerText = rateMsg.replace('{confidence}', confidence);

    hideLoadingIndicator();
    showResultSection();
    document.querySelector('.image-upload-section').style.display = 'none'; 
}

function showLoadingIndicator(message = "이미지 분석 중...") {
    loadingIndicator.querySelector('p').innerText = message;
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
    resultEmoji.innerHTML = ''; 
    predictionResult.textContent = '';
    confidenceScore.textContent = '';
    selectedGender = null;
    genderMaleButton.classList.remove('active');
    genderFemaleButton.classList.remove('active');
    hideResultSection();
    hideLoadingIndicator();
    dropZone.style.display = 'block';
    imagePreviewContainer.style.display = 'none';
    imageUploadInput.value = ''; 
    document.querySelector('.image-upload-section').style.display = 'block'; 
}

function setupShareButtons(animalName, confidence) {
    const shareText = `저는 ${animalName} 입니다! (${confidence}% 확률) #동물상테스트`;
    const shareUrl = window.location.href; 

    const twitterButton = shareButtonsContainer.querySelector('[data-platform="twitter"]');
    if (twitterButton) {
        twitterButton.onclick = () => {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        };
    }

    const facebookButton = shareButtonsContainer.querySelector('[data-platform="facebook"]');
    if (facebookButton) {
        facebookButton.onclick = () => {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank');
        };
    }

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
                const msg = (window.getTranslation && window.getTranslation(window.currentLang, 'no_image_to_download_alert')) || "다운로드할 이미지가 없습니다.";
                alert(msg);
            }
        };
    }
}


document.addEventListener("DOMContentLoaded", init);
