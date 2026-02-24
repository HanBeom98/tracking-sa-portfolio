// saju-test.js
// Function to update dynamic content with translations
const updateSajuContent = () => {
    const birthYearSelect = document.getElementById('birth-year');
    const birthMonthSelect = document.getElementById('birth-month');
    const birthDaySelect = document.getElementById('birth-day');

    // Defensive check for saju elements before proceeding
    if (!birthYearSelect || !birthMonthSelect || !birthDaySelect) {
        return; 
    }

    const populateSelectors = (lang) => {
        const currentYear = new Date().getFullYear();
        birthYearSelect.innerHTML = ''; // Clear previous options
        for (let i = currentYear; i >= 1900; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}${window.getTranslation(lang, 'year_unit')}`;
            birthYearSelect.appendChild(option);
        }

        birthMonthSelect.innerHTML = '';
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}${window.getTranslation(lang, 'month_unit')}`;
            birthMonthSelect.appendChild(option);
        }

        birthDaySelect.innerHTML = '';
        for (let i = 1; i <= 31; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}${window.getTranslation(lang, 'day_unit')}`;
            birthDaySelect.appendChild(option);
        }
    };

    populateSelectors(window.currentLang);
    window.applyTranslations(window.currentLang);
};


// Function to format markdown content into HTML for fortune reading
const formatFortuneContent = (markdownText) => {
    let html = markdownText;

    // Replace ### headings with h3 with class fortune-title
    html = html.replace(/^###\s*(.*)$/gm, '<h3 class="fortune-title">$1</h3>');

    // Replace --- with hr with class fortune-divider
    html = html.replace(/^---\s*$/gm, '<hr class="fortune-divider">');

    // Wrap the entire content
    return `<div class="fortune-content-wrapper">${html}</div>`;
};

document.addEventListener('DOMContentLoaded', () => {
    const userNameInput = document.getElementById('user-name');
    if (userNameInput) {
        userNameInput.placeholder = window.getTranslation(window.currentLang, 'name_placeholder');
    }
    
    const sajuForm = document.querySelector('.saju-input-section');
    
    if (!sajuForm) {
        return;
    }

    const getSajuButton = document.getElementById('get-saju-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultContainer = document.getElementById('result-container');
    const sajuReadingText = document.getElementById('saju-reading-text');
    const retakeButton = document.getElementById('retake-button');

    updateSajuContent();

    window.addEventListener('languageChanged', (event) => {
        updateSajuContent();
        if (userNameInput) {
            userNameInput.placeholder = window.getTranslation(window.currentLang, 'name_placeholder');
        }
    });

    getSajuButton.addEventListener('click', async () => {
        const name = userNameInput.value.trim();
        const birthYear = document.getElementById('birth-year').value;
        const birthMonth = document.getElementById('birth-month').value;
        const birthDay = document.getElementById('birth-day').value;
        const genderMaleRadio = document.getElementById('gender-male');
        const gender = genderMaleRadio.checked ? 'male' : 'female';
        // 태어난 시간은 'unknown'으로 고정
        const birthHour = 'unknown';

        if (!name || !birthYear || !birthMonth || !birthDay) {
            alert(window.getTranslation(window.currentLang, 'saju_input_missing'));
            return;
        }

        loadingIndicator.style.display = 'flex';
        resultContainer.style.display = 'none';
        sajuReadingText.textContent = '';
        if (getSajuButton) {
            getSajuButton.disabled = true;
        }

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        try {
            const response = await fetch('https://tracking-sa.vercel.app/api/fortune', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    birthDate: {
                        year: birthYear,
                        month: birthMonth,
                        day: birthDay
                    },
                    birthTime: birthHour,
                    gender,
                    language: localStorage.getItem('lang') || 'ko',
                    currentDate: {
                        year: currentYear,
                        month: currentMonth,
                        day: currentDay
                    }
                })
            });

            const data = await response.json();

            if (response.ok) {
                const sajuReading = data.sajuReading;
                sajuReadingText.innerHTML = formatFortuneContent(sajuReading);
            } else {
                sajuReadingText.textContent = window.getTranslation(window.currentLang, 'saju_api_error') + (data.error || response.statusText);
            }

        } catch (error) {
            console.error('Frontend Saju API call error:', error);
            sajuReadingText.textContent = window.getTranslation(window.currentLang, 'saju_network_error');
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            if (resultContainer) resultContainer.style.display = 'block';
            if (getSajuButton) getSajuButton.disabled = false;
        }
    });

    retakeButton.addEventListener('click', () => {
        if (resultContainer) resultContainer.style.display = 'none';
        if (userNameInput) userNameInput.value = '';
        const by = document.getElementById('birth-year');
        const bm = document.getElementById('birth-month');
        const bd = document.getElementById('birth-day');
        const gm = document.getElementById('gender-male');

        if (by) by.value = new Date().getFullYear();
        if (bm) bm.value = 1;
        if (bd) bd.value = 1;
        if (gm) gm.checked = true;
    });
});