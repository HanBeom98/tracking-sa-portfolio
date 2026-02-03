const URL = "https://teachablemachine.withgoogle.com/models/Jtg0ClWaE/";

let model, labelContainer, maxPredictions;

async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    const imageUpload = document.getElementById("image-upload");
    const predictButton = document.getElementById("predict-button");
    const imagePreview = document.getElementById("image-preview");

    imageUpload.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    predictButton.addEventListener("click", async () => {
        if (imagePreview.src) {
            await predict();
        } else {
            alert("먼저 이미지를 업로드해주세요.");
        }
    });

    labelContainer = document.getElementById("label-container");
    for (let i = 0; i < maxPredictions; i++) {
        labelContainer.appendChild(document.createElement("div"));
    }
}

async function predict() {
    const image = document.getElementById("image-preview");
    const prediction = await model.predict(image);
    for (let i = 0; i < maxPredictions; i++) {
        const classPrediction =
            prediction[i].className + ": " + prediction[i].probability.toFixed(2);
        labelContainer.childNodes[i].innerHTML = classPrediction;
    }
}

document.addEventListener("DOMContentLoaded", init);
