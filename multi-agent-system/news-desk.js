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
        verdict: String(plan.verdict || "NEUTRAL").toUpperCase(),
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
    const editorInstruction = `당신은 글로벌 기술 투자자들의 철학을 계승한 '수석 편집장'입니다. 
    당신은 아래의 **3대 가치 심사 기준**에 따라 뉴스를 엄격히 분류합니다.

    [가치 심사 기준]
    1. 레버리지 (Leverage): 개인이나 소규모 팀이 큰 자본 없이도 압도적인 생산성을 낼 수 있게 돕는 소식인가? (예: 오픈소스 LLM, 새로운 개발 도구) -> ENTHUSIASTIC
    2. 실질적 유틸리티 (Utility): 단순히 이름만 'AI'를 붙인 거품(AI-Washing)인가, 아니면 실제로 작동하는 실체가 있는가? (예: PPT만 있는 발표, 대기업의 홍보성 기사) -> CRITICAL
    3. 개방성과 자유 (Freedom): 사용자의 데이터를 독점하려 하는가, 아니면 생태계를 확장하는가? (예: 폐쇄적인 데이터 정책) -> CRITICAL
    
    위 기준에 따라 [verdict]를 결정하세요. 판단이 모호한 단순 사실 보도는 NEUTRAL로 분류합니다.`;

    const editorPrompt = `뉴스 제목: ${title}\n뉴스 요약: ${summary}\n\n결과 포맷:\n{\n  "verdict": "CRITICAL | ENTHUSIASTIC | NEUTRAL",\n  "angle": "투자자 관점에서의 기사 핵심",\n  "targetAudience": "돈과 기술의 기회를 찾는 독자",\n  "keyPoints": ["포인트1", "포인트2", "포인트3"]\n}`;

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

    console.warn("⚠️ Falling back to default editor plan.");
    return {
        verdict: "NEUTRAL",
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
        console.log("📝 [Step 1] Planning the story & Setting Tone...");
        const plan = await planStoryWithRetry(title, summary);
        console.log(`🎯 Verdict: ${plan.verdict}`);

        console.log("✍️ [Step 2] Writing content (KO/EN)...");
        const writerInstruction = `당신은 업계에서 가장 '솔직한' 전문 기술 투자자이자 전문 칼럼니스트입니다. 
        당신은 편집장의 판결(Verdict)에 따라 말투와 스탠스를 180도 바꿉니다.

        [판결별 말투 가이드 - 절대 엄수]
        - CRITICAL (비판): "이건 사기입니다." 냉소적이고 날카롭게 비판하세요. 독자에게 경고를 날리세요.
        - ENTHUSIASTIC (찬사): "이건 미쳤습니다!" 흥분을 감추지 말고, 왜 이 기술에 인생을 걸어야 하는지 열정적으로 설득하세요.
        - NEUTRAL (중립): "팩트만 체크합시다." 차갑고 냉정하게 데이터 중심의 분석을 하세요.

        [공통 집필 원칙]
        1. 무자비한 솔직함: 가식을 버리고 옆에서 속삭이듯 친근하면서도 권위 있는 구어체를 사용하세요.
        2. 금지어: '혁신', '전망', '기대' 등 AI스러운 상투적인 단어는 절대 금지. 대신 '진짜', '파괴적', '뒷구멍', '돈 냄새', '설계' 같은 생생한 단어를 쓰세요.
        3. 소제목: 내용의 성격에 따라 직접 지으세요. (예: "여기에 돈 넣으면 바보입니다" 혹은 "내가 이 기술에 열광하는 3가지 이유")
        4. 심층 분석(Depth): 단순히 사실만 말하지 마세요. 해당 이슈가 업계 생태계에 미치는 **기술적, 경제적 파장을 최소 3~4문단 이상의 상세한 분석**으로 풀어내세요.
        5. 근거 보강: 주장을 뒷받침하기 위해 **경쟁사 현황, 예상되는 시장 규모, 혹은 과거 유사한 기술 트렌드와의 비유**를 1개 이상 반드시 포함하세요.
        6. 압도적 분량: 한국어 버전은 반드시 공백 포함 **1,200자 이상**의 풍부한 분량으로 작성하세요. 독자가 이 칼럼 하나로 해당 이슈의 '속사정'을 완전히 꿰뚫어 보게 해야 합니다.`;

        const writerPrompt = `
[원본 뉴스]
제목: ${title}
요약: ${summary}

[편집장의 판결]
판결: ${plan.verdict}
관점: ${plan.angle}
핵심 포인트: ${plan.keyPoints.join(', ')}

위 내용을 바탕으로 한국어와 영어 두 가지 버전의 전문 투자 칼럼을 작성하세요.
한국어 버전은 1,200자 이상의 충분한 깊이를 가져야 하며, 반드시 [판결: ${plan.verdict}]에 맞는 날카로운 스탠스를 유지해야 합니다.

반드시 아래의 출력 형식을 엄격하게 지켜주세요:
[KO_START]
# (한국어 칼럼 제목)
(한국어 칼럼 본문 - 분석 중심, 1200자 이상)
[KO_END]

[EN_START]
# (영어 칼럼 제목)
(영어 칼럼 본문)
[EN_END]`;
        const draft = await callGemini(writerInstruction, writerPrompt, 0.7);

        console.log("🔍 [Step 3] Reviewing and injecting hashtags...");
        const reviewerInstruction = "당신은 'SEO 및 교열 전문가'입니다. 기자의 원고를 검토하여 오타를 수정하고, 각 언어 버전에 맞는 트렌디한 해시태그를 추가합니다.";
        const reviewerPrompt = `
[기자 원고]
${draft}

위 원고를 검수하고, 오타를 수정하세요.
각 언어의 본문 끝부분(즉, [KO_END] 와 [EN_END] 태그 바로 앞)에 해당 언어에 맞는 해시태그 5개를 다음 형식으로 추가하세요.
형식: ##HASHTAGS##: #태그1 #태그2 #태그3 #태그4 #태그5

반드시 아래의 형식을 유지해서 출력하세요 (대괄호 태그 필수 포함):
[KO_START]
(한국어 기사 전체)
##HASHTAGS##: ...
[KO_END]

[EN_START]
(영어 기사 전체)
##HASHTAGS##: ...
[EN_END]

다른 부연 설명은 절대 하지 마세요.
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
