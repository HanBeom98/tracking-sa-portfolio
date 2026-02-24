import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent`;

async function callGemini(systemInstruction, userPrompt, temperature = 0.7) {
    const body = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature, maxOutputTokens: 4096 }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API Error');
    return data.candidates[0].content.parts.map(p => p.text).join('
');
}

async function newsDeskPipeline(title, summary) {
    try {
        // [Step 1] 편집장 (Planner) - 기사 기획
        const editorInstruction = "당신은 IT 전문 매체의 '편집장'입니다. 주어진 영문 뉴스 제목과 요약을 분석하여, 한국과 글로벌 독자들에게 가장 흥미로운 관점(Angle)과 핵심 전달 사항 3가지를 기획하세요. JSON 형식으로만 답변하세요.";
        const editorPrompt = `뉴스 제목: ${title}
뉴스 요약: ${summary}

결과 포맷:
{
  "angle": "기사의 핵심 관점",
  "targetAudience": "타겟 독자층",
  "keyPoints": ["포인트1", "포인트2", "포인트3"]
}`;
        
        let editorPlanText = await callGemini(editorInstruction, editorPrompt, 0.2);
        editorPlanText = editorPlanText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const plan = JSON.parse(editorPlanText);

        // [Step 2] 수석 기자 (Writer) - 한/영 기사 집필
        const writerInstruction = "당신은 IT 전문 '수석 기자'입니다. 편집장의 기획안을 바탕으로 전문적이고 통찰력 있는 기사를 작성하세요.";
        const writerPrompt = `
[원본 뉴스]
제목: ${title}
요약: ${summary}

[편집장 기획안]
관점: ${plan.angle}
핵심 포인트: ${plan.keyPoints.join(', ')}

위 내용을 바탕으로 한국어와 영어 두 가지 버전의 기사를 작성하세요.
1. 제목은 검색 최적화(SEO)를 고려하여 흥미롭게 작성하고 '#'으로 시작하세요.
2. 본문은 가독성을 위해 불릿 포인트(-)를 적극 활용하세요.
3. '## 🔍 Deep Dive' 섹션을 만들어 기술적/산업적 분석을 3~4문장으로 추가하세요.
4. '## 수익화 아이디어' 섹션에 이 기술을 활용한 비즈니스 아이디어 3가지를 제시하세요.

반드시 다음 태그로 감싸서 출력하세요:
[KO_START]
...한국어 내용...
[KO_END]
[EN_START]
...영어 내용...
[EN_END]
`;
        const draft = await callGemini(writerInstruction, writerPrompt, 0.7);

        // [Step 3] 교열 및 SEO 전문가 (Reviewer) - 최종 검수 및 해시태그 주입
        const reviewerInstruction = "당신은 'SEO 및 교열 전문가'입니다. 기자의 원고를 검토하여 오타를 수정하고, 각 언어 버전에 맞는 트렌디한 해시태그를 추가합니다.";
        const reviewerPrompt = `
[기자 원고]
${draft}

위 원고를 검수하고, [KO_END] 와 [EN_END] 태그 바로 직전에 각각 해당 언어에 맞는 해시태그 5개를 다음 형식으로 추가하세요.
형식: ##HASHTAGS##: #태그1 #태그2 #태그3 #태그4 #태그5

최종 검수된 전체 원고(태그 포함)만 그대로 출력하세요. 다른 부연 설명은 하지 마세요.
`;
        const finalArticle = await callGemini(reviewerInstruction, reviewerPrompt, 0.3);
        
        // Python이 읽을 수 있도록 콘솔에 출력
        console.log(finalArticle);

    } catch (err) {
        console.error("NEWS_DESK_ERROR:", err.message);
        process.exit(1);
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("사용법: node news-desk.js <제목> <요약>");
    process.exit(1);
}

newsDeskPipeline(args[0], args[1]);
