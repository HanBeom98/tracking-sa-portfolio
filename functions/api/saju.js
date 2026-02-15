function addCORSHeaders(response) {
    response.headers.set('Access-Control-Allow-Origin', 'https://trackingsa.com');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
}

// /functions/api/saju.js
export async function onRequest(context) {
    if (request.method === 'OPTIONS') {
        return addCORSHeaders(new Response(null, { status: 204 }));
    }

    const { request, env } = context;

    // Early exit if API key is not configured
    if (!env.GEMINI_API_KEY) {
        console.error('CRITICAL: GEMINI_API_KEY environment variable not set.');
        return addCORSHeaders(new Response(JSON.stringify({ error: 'Server configuration error: API key is not set.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }));
    }

    if (request.method !== 'POST') {
        return addCORSHeaders(new Response('Method Not Allowed', { status: 405 }));
    }

    const { name, birthDate, birthTime, gender, language, currentDate } = await request.json(); // Destructure language and currentDate

    if (!name || !birthDate || !birthTime || !gender || !currentDate) {
        return addCORSHeaders(new Response(JSON.stringify({ error: '이름, 생년월일, 성별, 현재 날짜 정보를 모두 입력해주세요.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        }));
    }
    }

    const GEMINI_API_KEY = env.GEMINI_API_KEY; // Access API key from Cloudflare environment variables
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

    let prompt = '';
        if (language === 'en') {
            prompt = `Today is ${currentDate.year} / ${currentDate.month} / ${currentDate.day}. You must interpret the fortune based on this date.
    
    Please provide the daily fortune reading in English. You are a friendly and hopeful fortune teller. Explain the user's daily fortune in markdown format, following these guidelines:
    
    - Start the response with a one-line summary of the entire fortune, formatted as a markdown heading, e.g., "### 🌟 Today's Fortune (${currentDate.month}/${currentDate.day}) Summary".
    - The body content must include the following markdown subheadings:
      - ### 🍀 Today's General Fortune
      - ### 💰 Wealth and Business
      - ### ✨ Lucky Item
    - Each section's content should be explained specifically and clearly.
    - Write everything in a polite and warm tone, like a friendly consultant. Avoid excessive use of emojis.
    
    User Information:
    Name: ${name}
    Date of Birth: ${birthDate.year} / ${birthDate.month} / ${birthDate.day}
    Time of Birth: ${birthTime === 'unknown' ? 'Unknown' : birthTime + ':00'}
    Gender: ${gender === 'male' ? 'Male' : 'Female'}
    `;
        } else { // Default to Korean
        prompt = `오늘은 ${currentDate.year}년 ${currentDate.month}월 ${currentDate.day}일입니다. 반드시 이 날짜를 기준으로 운세를 풀이하세요.

사용자의 이름, 생년월일시, 성별 정보가 주어지면, 오늘의 운세를 상담가처럼 친절하고 희망적인 어조로 자세히 설명하는 마크다운 글을 작성해 주세요. 다음 지침을 따르세요:

- 글의 시작은 항상 ### 🌟 오늘의 운세 (${currentDate.month}월 ${currentDate.day}일) 한 줄 요약 과 같은 형식으로 시작하여 전체 운세의 핵심 내용을 1줄 요약해 주십시오.
- 본문 내용은 다음의 마크다운 소제목을 반드시 사용하여 구성해 주십시오:
  - ### 🍀 오늘의 총운
  - ### 💰 재물과 비즈니스
  - ### ✨ 행운의 아이템
- 각 섹션의 내용은 구체적이고 명확하게 설명해 주십시오.
- 모든 내용은 존댓말을 사용하여 친근하고 따뜻한 상담가 톤으로 작성해 주십시오. 과도한 이모지 사용은 자제해 주세요.

사용자 정보:
이름: ${name}
생년월일: ${birthDate.year}년 ${birthDate.month}월 ${birthDate.day}일
태어난 시간: ${birthTime === 'unknown' ? '모름' : birthTime}
성별: ${gender === 'male' ? '남성' : '여성'}
`;
    }

    try {
        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-client': 'gl-js/ saju-api/1.0.0' // Added safety header
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        const geminiData = await geminiResponse.json();

        if (geminiResponse.ok && geminiData.candidates && geminiData.candidates.length > 0) {
            const sajuReading = geminiData.candidates[0].content.parts[0].text;
            return addCORSHeaders(new Response(JSON.stringify({ sajuReading }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            }));
        } else {
            console.error('Gemini API Error:', geminiData);
            const errorMessage = geminiData.error?.message || '사주 풀이를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.';
            return addCORSHeaders(new Response(JSON.stringify({ error: errorMessage }), {
                headers: { 'Content-Type': 'application/json' },
                status: geminiResponse.status || 500
            }));
        }

    } catch (error) {
        console.error('Function execution error:', error);
        return addCORSHeaders(new Response(JSON.stringify({ error: `서버 내부 오류가 발생했습니다: ${error.message}` }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        }));
    }
}