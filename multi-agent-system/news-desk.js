import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 4096);
const GEMINI_RETRY_MAX = Number(process.env.GEMINI_RETRY_MAX || 3);
const GEMINI_RETRY_BASE_MS = Number(process.env.GEMINI_RETRY_BASE_MS || 1200);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractJsonObject(text) {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("No JSON object found");
    }
    return cleaned.slice(start, end + 1);
}

function normalizePlan(plan) {
    if (!plan || typeof plan !== 'object') {
        throw new Error("Plan must be an object");
    }
    const keyPoints = Array.isArray(plan.keyPoints)
        ? plan.keyPoints.map((p) => String(p).trim()).filter(Boolean).slice(0, 3)
        : [];
    if (!plan.angle || keyPoints.length === 0) {
        throw new Error("Missing required plan fields");
    }
    return {
        angle: String(plan.angle).trim(),
        targetAudience: String(plan.targetAudience || "IT/AI 관심 독자").trim(),
        keyPoints
    };
}

async function callGemini(systemInstruction, userPrompt, temperature = 0.7) {
    // Merge system instruction and user prompt for better compatibility with v1 API
    const combinedPrompt = `${systemInstruction}\n\n[USER REQUEST]\n${userPrompt}`;
    
    const body = {
        contents: [{ parts: [{ text: combinedPrompt }] }],
        generationConfig: { temperature, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS }
    };

    let lastError;
    for (let attempt = 1; attempt <= GEMINI_RETRY_MAX; attempt += 1) {
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || 'API Error');
            }
            return data.candidates[0].content.parts.map(p => p.text).join('\n');
        } catch (err) {
            lastError = err;
            if (attempt >= GEMINI_RETRY_MAX) {
                break;
            }
            const delay = GEMINI_RETRY_BASE_MS * (2 ** (attempt - 1));
            console.warn(`⚠️ Gemini call failed (attempt ${attempt}/${GEMINI_RETRY_MAX}). Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }
    throw lastError || new Error("Unknown Gemini API error");
}

async function planStoryWithRetry(title, summary) {
    const editorInstruction = "당신은 IT 전문 매체의 '편집장'입니다. 주어진 영문 뉴스 제목과 요약을 분석해 JSON으로만 답하세요.";
    const editorPrompt = `뉴스 제목: ${title}\n뉴스 요약: ${summary}\n\n결과 포맷:\n{\n  "angle": "기사의 핵심 관점",\n  "targetAudience": "타겟 독자층",\n  "keyPoints": ["포인트1", "포인트2", "포인트3"]\n}`;

    let lastError;
    for (let i = 0; i < 3; i += 1) {
        try {
            const raw = await callGemini(editorInstruction, editorPrompt, 0.2);
            const parsed = JSON.parse(extractJsonObject(raw));
            return normalizePlan(parsed);
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ Editor JSON parse failed (attempt ${i + 1}/3): ${err.message}`);
        }
    }

    console.warn("⚠️ Falling back to default editor plan due to JSON parsing failure.");
    return {
        angle: `${title}의 핵심 기술·시장 영향`,
        targetAudience: "IT/AI 관심 독자",
        keyPoints: [
            "핵심 기술 변화",
            "산업/시장 영향",
            "실무 활용 포인트"
        ]
    };
}

async function newsDeskPipeline(title, summary) {
    try {
        if (!GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is missing");
        }
        console.log("📝 [Step 1] Planning the story...");
        const plan = await planStoryWithRetry(title, summary);

        console.log("✍️ [Step 2] Writing content (KO/EN)...");
        const writerInstruction = "당신은 IT 전문 '수석 기자'입니다. 편집장의 기획안을 바탕으로 전문적이고 통찰력 있는 기사를 작성하세요.";
        const writerPrompt = `
[원본 뉴스]
제목: ${title}
요약: ${summary}

[편집장 기획안]
관점: ${plan.angle}
핵심 포인트: ${plan.keyPoints.join(', ')}

위 내용을 바탕으로 한국어와 영어 두 가지 버전의 기사를 작성하세요.

[작성 가이드]
1. 제목: 클릭을 부르는 흥미로운 제목을 작성하세요. '#' 문자나 '제목:' 접두사는 절대 사용하지 마세요.
2. 본문 첫 줄에 제목을 다시 쓰지 마세요. 바로 본문 내용을 시작하세요.
3. 가독성을 위해 불릿 포인트(-)를 적극 활용하고, 문단은 짧게 유지하세요.
4. '## 🔍 Deep Dive': 기술적/산업적 임팩트를 깊이 있게 분석하는 3~4문장을 포함하세요.
5. '## 💡 수익화 아이디어': 이 기술이나 소식을 활용한 실제적인 비즈니스 모델 3가지를 구체적으로 제시하세요.

반드시 다음 태그로 감싸서 출력하세요:
[KO_START]
...한국어 내용...
[KO_END]
[EN_START]
...영어 내용...
[EN_END]
`;
        const draft = await callGemini(writerInstruction, writerPrompt, 0.7);

        console.log("🔍 [Step 3] Reviewing and injecting hashtags...");
        const reviewerInstruction = "당신은 'SEO 및 교열 전문가'입니다. 기자의 원고를 검토하여 오타를 수정하고, 각 언어 버전에 맞는 트렌디한 해시태그를 추가합니다.";
        const reviewerPrompt = `
[기자 원고]
${draft}

위 원고를 검수하고, [KO_END] 와 [EN_END] 태그 바로 직전에 각각 해당 언어에 맞는 해시태그 5개를 다음 형식으로 추가하세요.
형식: ##HASHTAGS##: #태그1 #태그2 #태그3 #태그4 #태그5

최종 검수된 전체 원고(태그 포함)만 그대로 출력하세요. 다른 부연 설명은 하지 마세요.
`;
        const finalArticle = await callGemini(reviewerInstruction, reviewerPrompt, 0.3);
        
        console.log("\n--- FINAL MULTI-AGENT CONTENT ---\n");
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
