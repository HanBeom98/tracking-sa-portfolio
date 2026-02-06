// saju-test.js
import { currentLang, applyTranslations, getTranslation } from './common.js'; // Import necessary functions

// Function to update dynamic content with translations
const updateSajuContent = () => {
    const birthYearSelect = document.getElementById('birth-year');
    const birthMonthSelect = document.getElementById('birth-month');
    const birthDaySelect = document.getElementById('birth-day');
    const birthHourSelect = document.getElementById('birth-hour');

    const populateSelectors = (lang) => {
        const currentYear = new Date().getFullYear();
        birthYearSelect.innerHTML = ''; // Clear previous options
        for (let i = currentYear; i >= 1900; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}${getTranslation(lang, 'year')}`; // Combine number and translated unit
            birthYearSelect.appendChild(option);
        }

        birthMonthSelect.innerHTML = '';
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}${getTranslation(lang, 'month')}`; // Combine number and translated unit
            birthMonthSelect.appendChild(option);
        }

        birthDaySelect.innerHTML = '';
        for (let i = 1; i <= 31; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}${getTranslation(lang, 'day')}`; // Combine number and translated unit
            birthDaySelect.appendChild(option);
        }

        birthHourSelect.innerHTML = '';
        // Add "unknown" option for birth hour
        const unknownOption = document.createElement('option');
        unknownOption.value = 'unknown';
        unknownOption.textContent = getTranslation(lang, 'unknown'); // Translated "Unknown"
        birthHourSelect.appendChild(unknownOption);

        // Populate hours (0-23)
        for (let i = 0; i <= 23; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${String(i).padStart(2, '0')}${getTranslation(lang, 'hour')}`; // Combine number and translated unit
            birthHourSelect.appendChild(option);
        }
        birthHourSelect.value = 'unknown'; // Set "Unknown" as default
    };

    populateSelectors(currentLang);
    applyTranslations(currentLang); // Apply translations to static elements
};


document.addEventListener('DOMContentLoaded', () => {
    const userNameInput = document.getElementById('user-name');
    const getSajuButton = document.getElementById('get-saju-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultContainer = document.getElementById('result-container');
    const sajuReadingText = document.getElementById('saju-reading-text');
    const retakeButton = document.getElementById('retake-button');

    updateSajuContent(); // Initial content update on page load

    // Listen for custom event dispatched when language changes in common.js
    window.addEventListener('languageChanged', (event) => {
        updateSajuContent(); // Re-render dynamic content with new language
    });

    getSajuButton.addEventListener('click', async () => {
        const name = userNameInput.value.trim();
        const birthYear = document.getElementById('birth-year').value;
        const birthMonth = document.getElementById('birth-month').value;
        const birthDay = document.getElementById('birth-day').value;
        const birthHour = document.getElementById('birth-hour').value;
        const genderMaleRadio = document.getElementById('gender-male');
        const gender = genderMaleRadio.checked ? 'male' : 'female';

        if (!name || !birthYear || !birthMonth || !birthDay) {
            alert(getTranslation(currentLang, 'saju_input_missing'));
            return;
        }

        loadingIndicator.style.display = 'flex';
        resultContainer.style.display = 'none';
        sajuReadingText.textContent = '';
        getSajuButton.disabled = true; // Disable button to prevent duplicate clicks

        try {
            console.log('Current language for API request:', currentLang); // Debugging line
            const response = await fetch('/api/saju', { // Call the Cloudflare Function endpoint
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
                    language: currentLang // Send language parameter
                })
            });

            const data = await response.json();

            if (response.ok) {
                sajuReadingText.textContent = data.sajuReading;
            } else {
                sajuReadingText.textContent = getTranslation(currentLang, 'saju_api_error') + (data.error || response.statusText);
            }

        } catch (error) {
            console.error('Frontend Saju API call error:', error);
            sajuReadingText.textContent = getTranslation(currentLang, 'saju_network_error');
        } finally {
            loadingIndicator.style.display = 'none';
            resultContainer.style.display = 'block';
            getSajuButton.disabled = false; // Re-enable button
        }
    });

    retakeButton.addEventListener('click', () => {
        resultContainer.style.display = 'none';
        userNameInput.value = '';
        document.getElementById('birth-year').value = new Date().getFullYear();
        document.getElementById('birth-month').value = 1;
        document.getElementById('birth-day').value = 1;
        document.getElementById('birth-hour').value = 'unknown';
        document.getElementById('gender-male').checked = true;
    });
});
