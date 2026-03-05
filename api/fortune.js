// /api/fortune.js - Vercel Standalone Debug Handler
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Vercel Env Error: GEMINI_API_KEY is missing.' });
        }

        let data = req.body;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { /* skip */ }
        }

        const { name, birthDate, gender, language, currentDate } = data;
        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

        // 날짜 데이터가 객체인지 문자열인지 유연하게 대응
        const cYear = currentDate?.year || new Date().getFullYear();
        const cMonth = currentDate?.month || (new Date().getMonth() + 1);
        const cDay = currentDate?.day || new Date().getDate();

        const bYear = birthDate?.year || '2000';
        const bMonth = birthDate?.month || '1';
        const bDay = birthDate?.day || '1';

        let prompt = '';
        if (language === 'en') {
            prompt = `Today is ${cYear} / ${cMonth} / ${cDay}. You must interpret the fortune based on this date.
    
    Please provide the daily fortune reading in English. You are a friendly and hopeful fortune teller. Explain the user's daily fortune in markdown format, following these guidelines:
    
    - Start the response with a one-line summary of the entire fortune, formatted as a markdown heading, e.g., "### 🌟 Today's Fortune (${cMonth}/${cDay}) Summary".
    - The body content must include the following markdown subheadings:
      - ### 🍀 Today's General Fortune
      - ### 💰 Wealth and Business
      - ### ✨ Lucky Item
    - Each section's content should be explained specifically and clearly.
    - Write everything in a polite and warm tone, like a friendly consultant. Avoid excessive use of emojis.
    - Analyze the fortune based on the Name, Date of Birth, and Gender provided.
    
    User Information:
    Name: ${name}
    Date of Birth: ${bYear} / ${bMonth} / ${bDay}
    Gender: ${gender === 'male' ? 'Male' : 'Female'}
    `;
        } else { // Default to Korean
            prompt = `오늘은 ${cYear}년 ${cMonth}월 ${cDay}일입니다. 반드시 이 날짜를 기준으로 운세를 풀이하세요.

사용자의 이름, 생년월일, 성별 정보가 주어지면, 오늘의 운세를 상담가처럼 친절하고 희망적인 어조로 자세히 설명하는 마크다운 글을 작성해 주세요. 다음 지침을 따르세요:

- 글의 시작은 항상 ### 🌟 오늘의 운세 (${cMonth}월 ${cDay}일) 한 줄 요약 과 같은 형식으로 시작하여 전체 운세의 핵심 내용을 1줄 요약해 주십시오.
- 본문 내용은 다음의 마크다운 소제목을 반드시 사용하여 구성해 주십시오:
  - ### 🍀 오늘의 총운
  - ### 💰 재물과 비즈니스
  - ### ✨ 행운의 아이템
- 각 섹션의 내용은 구체적이고 명확하게 설명해 주십시오.
- 모든 내용은 존댓말을 사용하여 친근하고 따뜻한 상담가 톤으로 작성해 주십시오. 과도한 이모지 사용은 자제해 주세요.
- 태어난 시간 정보는 주어지지 않으므로, 이름과 생년월일, 성별만을 바탕으로 분석해 주십시오.

사용자 정보:
이름: ${name}
생년월일: ${bYear}년 ${bMonth}월 ${bDay}일
성별: ${gender === 'male' ? '남성' : '여성'}
`;
        }

        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Referer': 'https://trackingsa.com'
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const geminiData = await geminiResponse.json();

        if (geminiResponse.ok) {
            const fortuneReading = geminiData.candidates[0].content.parts[0].text;
            return res.status(200).json({ sajuReading: fortuneReading });
        } else {
            return res.status(500).json(geminiData);
        }
    } catch (error) {
        return res.status(500).json({ error: 'Vercel API Runtime Error', message: error.message });
    }
}
