// saju-test.js
document.addEventListener('DOMContentLoaded', () => {
    const userNameInput = document.getElementById('user-name');
    const birthYearSelect = document.getElementById('birth-year');
    const birthMonthSelect = document.getElementById('birth-month');
    const birthDaySelect = document.getElementById('birth-day');
    const birthHourSelect = document.getElementById('birth-hour');
    const genderMaleRadio = document.getElementById('gender-male');
    const genderFemaleRadio = document.getElementById('gender-female');
    const getSajuButton = document.getElementById('get-saju-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultContainer = document.getElementById('result-container');
    const sajuReadingText = document.getElementById('saju-reading-text');
    const retakeButton = document.getElementById('retake-button');

    // Populate year, month, day, and hour selectors
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= 1900; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        birthYearSelect.appendChild(option);
    }

    for (let i = 1; i <= 12; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        birthMonthSelect.appendChild(option);
    }

    for (let i = 1; i <= 31; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        birthDaySelect.appendChild(option);
    }

    // Populate hours (0-23)
    for (let i = 0; i <= 23; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${String(i).padStart(2, '0')}:00`;
        birthHourSelect.appendChild(option);
    }
    // Add "unknown" option for birth hour
    const unknownOption = document.createElement('option');
    unknownOption.value = 'unknown';
    unknownOption.textContent = '모름';
    birthHourSelect.insertBefore(unknownOption, birthHourSelect.firstChild);
    birthHourSelect.value = 'unknown'; // Set "모름" as default


    getSajuButton.addEventListener('click', async () => {
        const name = userNameInput.value.trim();
        const birthYear = birthYearSelect.value;
        const birthMonth = birthMonthSelect.value;
        const birthDay = birthDaySelect.value;
        const birthHour = birthHourSelect.value;
        const gender = genderMaleRadio.checked ? 'male' : 'female';

        if (!name || !birthYear || !birthMonth || !birthDay) {
            const currentLanguage = document.documentElement.lang || 'ko';
            alert(getTranslation(currentLanguage, 'saju_input_missing'));
            return;
        }

        loadingIndicator.style.display = 'flex';
        resultContainer.style.display = 'none';
        sajuReadingText.textContent = '';
        getSajuButton.disabled = true; // Disable button to prevent duplicate clicks

        try {
            const currentLanguage = document.documentElement.lang || 'ko'; // Detect current language
            console.log('Current language for API request:', currentLanguage); // Debugging line
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
                    language: currentLanguage // Send language parameter
                })
            });

            const data = await response.json();

            if (response.ok) {
                sajuReadingText.textContent = data.sajuReading;
            } else {
                // Use translations for error messages
                sajuReadingText.textContent = getTranslation(currentLanguage, 'saju_api_error') + (data.error || response.statusText);
            }

        } catch (error) {
            console.error('Frontend Saju API call error:', error);
            // Use translations for network error messages
            sajuReadingText.textContent = getTranslation(currentLanguage, 'saju_network_error');
        } finally {
            loadingIndicator.style.display = 'none';
            resultContainer.style.display = 'block';
            getSajuButton.disabled = false; // Re-enable button
        }
    });

    retakeButton.addEventListener('click', () => {
        resultContainer.style.display = 'none';
        userNameInput.value = '';
        birthYearSelect.value = currentYear;
        birthMonthSelect.value = 1;
        birthDaySelect.value = 1;
        birthHourSelect.value = 'unknown';
        genderMaleRadio.checked = true;
    });
});
