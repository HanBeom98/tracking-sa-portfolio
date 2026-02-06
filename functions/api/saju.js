// /functions/api/saju.js
export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const { name, birthDate, birthTime, gender, language } = await request.json(); // Destructure language

    if (!name || !birthDate || !birthTime || !gender) {
        return new Response(JSON.stringify({ error: '이름, 생년월일, 성별 정보를 모두 입력해주세요.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const GEMINI_API_KEY = env.GEMINI_API_KEY; // Access API key from Cloudflare environment variables
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    let prompt = '';
    if (language === 'en') {
        prompt = `You are a 20-year experienced master of "Saju" (Four Pillars of Destiny), a traditional Korean form of fortune-telling based on birth information. Explain the concept of Saju simply for a foreign (English) audience. Based on the user's information, provide a detailed, exciting, and hopeful reading (around 500 characters) for today's overall fortune, wealth fortune, and relationship fortune. Use professional terminology but ensure it's easy to understand for someone unfamiliar with Saju.

User Information:
Name: ${name}
Date of Birth: ${birthDate.year} / ${birthDate.month} / ${birthDate.day}
Time of Birth: ${birthTime === 'unknown' ? 'Unknown' : birthTime + ':00'}
Gender: ${gender === 'male' ? 'Male' : 'Female'}

Begin today's Saju reading:`;
    } else { // Default to Korean
        prompt = `너는 20년 경력의 베테랑 명리학자야. 사용자의 정보를 분석해서 오늘의 총운, 재물운, 연애운을 500자 내외로 매우 상세하고 흥미진진하며 희망적으로 풀이해줘. 전문 용어를 섞어가며 신뢰감 있게 작성해줘.

사용자 정보:
이름: ${name}
생년월일: ${birthDate.year}년 ${birthDate.month}월 ${birthDate.day}일
태어난 시간: ${birthTime === 'unknown' ? '모름' : birthTime}
성별: ${gender === 'male' ? '남성' : '여성'}

오늘의 사주 풀이를 시작합니다:`;
    }

    try {
        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
            return new Response(JSON.stringify({ sajuReading }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            });
        } else {
            console.error('Gemini API Error:', geminiData);
            const errorMessage = geminiData.error?.message || '사주 풀이를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.';
            return new Response(JSON.stringify({ error: errorMessage }), {
                headers: { 'Content-Type': 'application/json' },
                status: geminiResponse.status || 500
            });
        }

    } catch (error) {
        console.error('Function execution error:', error);
        return new Response(JSON.stringify({ error: `서버 내부 오류가 발생했습니다: ${error.message}` }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
}