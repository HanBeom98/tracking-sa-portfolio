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
        prompt = `Please provide the daily fortune reading in English. You are a friendly and hopeful fortune teller. Explain the user's daily fortune in markdown format, following these guidelines:

- (Like a title, in large font) A one-line comprehensive summary of all fortunes.
- The body content must include:
  - Today's General Fortune: Describe the overall flow with warm advice to start the user's day positively.
  - Wealth Fortune: Provide specific and practical guidance regarding financial opportunities or points to be careful about.
  - Lucky Item: Suggest a special item to enhance the user's fortune.

Write everything in a polite and warm tone, like a friendly consultant. Avoid excessive use of emojis.
User Information:
Name: ${name}
Date of Birth: ${birthDate.year} / ${birthDate.month} / ${birthDate.day}
Time of Birth: ${birthTime === 'unknown' ? 'Unknown' : birthTime + ':00'}
Gender: ${gender === 'male' ? 'Male' : 'Female'}
Begin today's fortune reading`;
    } else { // Default to Korean
        prompt = `사용자의 이름, 생년월일시, 성별 정보가 주어지면, 오늘의 운세를 상담가처럼 친절하고 희망적인 어조로 자세히 설명하는 마크다운 글을 작성해 주세요. 다음 지침을 따르세요:

- (타이틀처럼 글자크게)모든 운의 종합적인 요약 1줄
- 본문 내용은 다음을 포함해야 합니다:
  - 오늘의 총운: 당신의 하루를 긍정적으로 시작할 수 있도록, 따뜻한 조언과 함께 전반적인 흐름을 설명해 줍니다.
  - 재물운: 재정적인 기회나 주의할 점에 대해 구체적이고 실용적인 지침을 제공합니다.
  - 행운의 아이템: 당신의 운세를 더욱 좋게 만들 특별한 아이템을 제안합니다.

모든 내용은 존댓말을 사용하여 친근하고 따뜻한 상담가 톤으로 작성해 주십시오. 과도한 이모지 사용은 자제해 주세요.
사용자 정보:
이름: ${name}
생년월일: ${birthDate.year}년 ${birthDate.month}월 ${birthDate.day}일
태어난 시간: ${birthTime === 'unknown' ? '모름' : birthTime}
성별: ${gender === 'male' ? '남성' : '여성'}
오늘의 운세를 확인하는중`;
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