// ai-test.js

document.addEventListener('DOMContentLoaded', () => {
    const startTestButton = document.getElementById('start-test-button');
    const quizSection = document.getElementById('quiz-section');
    const resultSection = document.getElementById('result-section');
    const testIntroSection = document.querySelector('.test-intro');

    const questionText = document.getElementById('question-text');
    const answersContainer = document.getElementById('answers-container');
    const nextButton = document.getElementById('next-button');

    const resultEmoji = document.getElementById('result-emoji');
    const resultName = document.getElementById('result-name');
    const resultDescription = document.getElementById('result-description');
    const copyLinkButton = document.getElementById('copy-link-button');
    const retakeTestButton = document.getElementById('retake-test-button');

    let currentQuestionIndex = 0;
    let scores = {
        chatgpt: 0,
        claude: 0,
        gemini: 0,
        perplexity: 0
    };

    const questions = [
        {
            question: "새로운 정보를 접했을 때, 당신의 첫 반응은?",
            options: [
                { text: "빠르게 핵심을 파악하고 효율적인 해결책을 찾는다.", score: { chatgpt: 1 } },
                { text: "다양한 관점에서 깊이 있게 이해하려 노력한다.", score: { claude: 1 } },
                { text: "기존 지식과 연결하여 새로운 아이디어를 떠올린다.", score: { gemini: 1 } },
                { text: "출처와 사실 여부를 꼼꼼히 확인하고 교차 검증한다.", score: { perplexity: 1 } }
            ]
        },
        {
            question: "동료와 프로젝트를 진행할 때, 당신의 역할은 주로?",
            options: [
                { text: "명확한 목표를 설정하고, 단계별 계획을 세워 리드한다.", score: { chatgpt: 1 } },
                { text: "팀원들의 의견을 경청하고, 조화로운 분위기를 만든다.", score: { claude: 1 } },
                { text: "다양한 아이디어를 제안하고, 여러 작업을 동시에 처리한다.", score: { gemini: 1 } },
                { text: "필요한 정보를 정확히 찾아 팀에 제공하고, 오류를 검토한다.", score: { perplexity: 1 } }
            ]
        },
        {
            question: "어떤 종류의 글쓰기를 가장 선호하나요?",
            options: [
                { text: "논리정연하고 간결한 보고서나 설명문.", score: { chatgpt: 1 } },
                { text: "감정을 풍부하게 담아내는 에세이나 스토리.", score: { claude: 1 } },
                { text: "자유로운 형식으로 창의적인 아이디어를 펼치는 글.", score: { gemini: 1 } },
                { text: "객관적인 사실과 데이터를 바탕으로 한 분석 글.", score: { perplexity: 1 } }
            ]
        },
        {
            question: "주말에 새로운 것을 배우기로 했다면, 무엇을 선택할까요?",
            options: [
                { text: "코딩이나 효율적인 문제 해결을 위한 기술.", score: { chatgpt: 1 } },
                { text: "심리학이나 예술처럼 인간의 감성을 이해하는 분야.", score: { claude: 1 } },
                { text: "여러 분야를 융합한 새로운 형태의 창작 활동.", score: { gemini: 1 } },
                { text: "최신 과학 논문을 읽거나 특정 주제를 깊이 탐구하는 것.", score: { perplexity: 1 } }
            ]
        },
        {
            question: "당신이 가장 중요하게 생각하는 가치는?",
            options: [
                { text: "합리적인 의사결정과 생산성.", score: { chatgpt: 1 } },
                { text: "공감 능력과 섬세한 소통.", score: { claude: 1 } },
                { text: "독창성과 유연한 사고.", score: { gemini: 1 } },
                { text: "진실성 있는 정보와 깊이 있는 지식.", score: { perplexity: 1 } }
            ]
        }
    ];

    const aiModels = {
        chatgpt: {
            name: "ChatGPT",
            emoji: "🧠",
            description: "당신은 논리적이고 효율적인 문제 해결사, ChatGPT와 닮았네요! 명확한 정보 처리와 빠른 결과 도출을 중요하게 생각하는군요."
        },
        claude: {
            name: "Claude",
            emoji: "💖",
            description: "당신은 섬세한 감성과 깊이 있는 통찰력을 가진 Claude형! 타인의 감정을 이해하고 디테일한 부분까지 놓치지 않는군요."
        },
        gemini: {
            name: "Gemini",
            emoji: "✨",
            description: "당신은 창의적이고 다재다능한 Gemini형! 여러 아이디어를 연결하고 새로운 결과물을 만들어내는 데 탁월합니다."
        },
        perplexity: {
            name: "Perplexity",
            emoji: "🔍",
            description: "당신은 사실을 중요하게 생각하는 탐구자, Perplexity형! 정확한 정보를 찾아내고 검증하는 데 열정적입니다."
        }
    };

    function displayQuestion() {
        if (currentQuestionIndex < questions.length) {
            const currentQ = questions[currentQuestionIndex];
            questionText.textContent = currentQ.question;
            answersContainer.innerHTML = '';
            currentQ.options.forEach((option, index) => {
                const button = document.createElement('button');
                button.textContent = option.text;
                button.classList.add('answer-button');
                button.addEventListener('click', () => selectAnswer(option.score));
                answersContainer.appendChild(button);
            });
            nextButton.style.display = 'none'; // Hide next button until an answer is selected
        } else {
            showResult();
        }
    }

    function selectAnswer(score) {
        // Apply score
        for (const ai in score) {
            scores[ai] += score[ai];
        }

        // Disable all answer buttons after selection
        Array.from(answersContainer.children).forEach(button => {
            button.disabled = true;
            button.classList.remove('selected'); // Remove any previously selected class
        });

        // Add a visual indicator to the selected answer
        event.target.classList.add('selected');
        
        nextButton.style.display = 'block'; // Show next button
    }

    function showResult() {
        quizSection.style.display = 'none';
        resultSection.style.display = 'block';

        let maxScore = -1;
        let resultAI = null;

        for (const ai in scores) {
            if (scores[ai] > maxScore) {
                maxScore = scores[ai];
                resultAI = ai;
            } else if (scores[ai] === maxScore) {
                // Handle ties - could be random, or a default. For now, first one wins.
                // A more sophisticated tie-breaker could be implemented here.
            }
        }

        const model = aiModels[resultAI];
        resultEmoji.textContent = model.emoji;
        resultName.textContent = model.name;
        resultDescription.textContent = model.description;

        // Update URL for sharing
        const resultUrl = new URL(window.location.href);
        resultUrl.searchParams.set('result', resultAI);
        window.history.replaceState({}, '', resultUrl);
    }

    function copyResultLink() {
        const resultUrl = window.location.href;
        navigator.clipboard.writeText(resultUrl).then(() => {
            alert('결과 링크가 클립보드에 복사되었습니다!');
        }).catch(err => {
            console.error('링크 복사 실패:', err);
            alert('링크 복사에 실패했습니다.');
        });
    }

    function retakeTest() {
        currentQuestionIndex = 0;
        scores = {
            chatgpt: 0,
            claude: 0,
            gemini: 0,
            perplexity: 0
        };
        testIntroSection.style.display = 'block';
        quizSection.style.display = 'none';
        resultSection.style.display = 'none';
        window.history.replaceState({}, '', window.location.pathname); // Clean URL
    }

    // Event Listeners
    startTestButton.addEventListener('click', () => {
        testIntroSection.style.display = 'none';
        quizSection.style.display = 'block';
        displayQuestion();
    });

    nextButton.addEventListener('click', () => {
        currentQuestionIndex++;
        displayQuestion();
    });

    copyLinkButton.addEventListener('click', copyResultLink);
    retakeTestButton.addEventListener('click', retakeTest);

    // Check for result in URL on load (for sharing)
    const urlParams = new URLSearchParams(window.location.search);
    const sharedResult = urlParams.get('result');
    if (sharedResult && aiModels[sharedResult]) {
        testIntroSection.style.display = 'none';
        quizSection.style.display = 'none';
        resultSection.style.display = 'block';

        const model = aiModels[sharedResult];
        resultEmoji.textContent = model.emoji;
        resultName.textContent = model.name;
        resultDescription.textContent = model.description;
    }
});
