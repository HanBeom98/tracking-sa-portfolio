// saju-test.js
// import { currentLang, applyTranslations, getTranslation } from './common.js'; // Import necessary functions - these are now global

// Function to update dynamic content with translations
const updateSajuContent = () => {
    const birthYearSelect = document.getElementById('birth-year');
    const birthMonthSelect = document.getElementById('birth-month');
    const birthDaySelect = document.getElementById('birth-day');
    const birthHourSelect = document.getElementById('birth-hour');

    // Defensive check for saju elements before proceeding
    if (!birthYearSelect || !birthMonthSelect || !birthDaySelect || !birthHourSelect) {
        // This page is likely not the saju test page, or elements are not yet available.
        // Or handle specific error if it's supposed to be the saju page.
        return; 
    }

    const populateSelectors = (lang) => {
        const currentYear = new Date().getFullYear();
        birthYearSelect.innerHTML = ''; // Clear previous options
        for (let i = currentYear; i >= 1900; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}${window.getTranslation(lang, 'year_unit')}`; // Combine number and translated unit
            birthYearSelect.appendChild(option);
        }

        birthMonthSelect.innerHTML = '';
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}${window.getTranslation(lang, 'month_unit')}`; // Combine number and translated unit
            birthMonthSelect.appendChild(option);
        }

        birthDaySelect.innerHTML = '';
        for (let i = 1; i <= 31; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}${window.getTranslation(lang, 'day_unit')}`; // Combine number and translated unit
            birthDaySelect.appendChild(option);
        }

        birthHourSelect.innerHTML = '';
        // Add "unknown" option for birth hour
        const unknownOption = document.createElement('option');
        unknownOption.value = 'unknown';
        unknownOption.textContent = window.getTranslation(lang, 'unknown_option'); // Translated "Unknown"
        birthHourSelect.appendChild(unknownOption);

        // Populate hours (0-23)
        for (let i = 0; i <= 23; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${String(i).padStart(2, '0')}${window.getTranslation(lang, 'hour_unit')}`; // Combine number and translated unit
            birthHourSelect.appendChild(option);
        }
        birthHourSelect.value = 'unknown'; // Set "Unknown" as default
    };

    populateSelectors(window.currentLang);
    window.applyTranslations(window.currentLang); // Apply translations to static elements
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
    userNameInput.placeholder = window.getTranslation(window.currentLang, 'name_placeholder'); // Apply placeholder translation
    const sajuForm = document.querySelector('.saju-input-section'); // More general selector for saju page
    
    // Defensive check for sajuForm. If not present, this is not the saju page, so return.
    if (!sajuForm) {
        console.log("Not saju-test.html, skipping saju-specific logic.");
        return;
    }

    const getSajuButton = document.getElementById('get-saju-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultContainer = document.getElementById('result-container');
    const sajuReadingText = document.getElementById('saju-reading-text');
    const retakeButton = document.getElementById('retake-button');

    updateSajuContent(); // Initial content update on page load

    // Listen for custom event dispatched when language changes in common.js
    window.addEventListener('languageChanged', (event) => {
        updateSajuContent(); // Re-render dynamic content with new language
        userNameInput.placeholder = window.getTranslation(window.currentLang, 'name_placeholder'); // Update placeholder translation on language change
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
            console.log("Input validation failed: Not all required fields are filled.");
            alert(window.getTranslation(window.currentLang, 'saju_input_missing'));
            return;
        }

        loadingIndicator.style.display = 'flex';
        resultContainer.style.display = 'none';
        sajuReadingText.textContent = '';
        if (getSajuButton) { // Defensive check
            getSajuButton.disabled = true; // Disable button to prevent duplicate clicks
        }

        // Get current date
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // Month is 0-indexed
        const currentDay = today.getDate();

        try {
            console.log('Current language for API request:', window.currentLang); // Debugging line
            const response = await fetch('https://tracking-sa.vercel.app/api/saju', { // Call the Cloudflare Function endpoint
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
                    language: window.currentLang, // Send language parameter
                    currentDate: { // Send current date
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
            if (loadingIndicator) loadingIndicator.style.display = 'none'; // Defensive check
            if (resultContainer) resultContainer.style.display = 'block'; // Defensive check
            if (getSajuButton) getSajuButton.disabled = false; // Re-enable button
        }
    });

    retakeButton.addEventListener('click', () => {
        if (resultContainer) resultContainer.style.display = 'none'; // Defensive check
        if (userNameInput) userNameInput.value = ''; // Defensive check
        // Defensive checks for select elements before accessing value
        const by = document.getElementById('birth-year');
        const bm = document.getElementById('birth-month');
        const bd = document.getElementById('birth-day');
        const bh = document.getElementById('birth-hour');
        const gm = document.getElementById('gender-male');

        if (by) by.value = new Date().getFullYear();
        if (bm) bm.value = 1;
        if (bd) bd.value = 1;
        if (bh) bh.value = 'unknown';
        if (gm) gm.checked = true;
    });
});