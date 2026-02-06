// /functions/api/saju.js
export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const { name, birthDate, birthTime, gender } = await request.json();

    if (!name || !birthDate || !gender) {
        return new Response('Missing required fields: name, birthDate, gender', { status: 400 });
    }

    const GEMINI_API_KEY = env.GEMINI_API_KEY; // Access API key from Cloudflare environment variables
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

    const prompt = `너는 20년 경력의 베테랑 명리학자야. 사용자의 정보를 분석해서 오늘의 총운, 재물운, 연애운을 500자 내외로 매우 상세하고 흥미진진하며 희망적으로 풀이해줘. 전문 용어를 섞어가며 신뢰감 있게 작성해줘.

사용자 정보:
이름: ${name}
생년월일: ${birthDate.year}년 ${birthDate.month}월 ${birthDate.day}일
태어난 시간: ${birthTime === 'unknown' ? '모름' : birthTime}
성별: ${gender === 'male' ? '남성' : '여성'}

오늘의 사주 풀이를 시작합니다:`;

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
            return new Response(JSON.stringify({ error: 'Failed to get Saju reading from AI.' }), {
                headers: { 'Content-Type': 'application/json' },
                status: geminiResponse.status || 500
            });
        }

    } catch (error) {
        console.error('Function execution error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error.' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
}