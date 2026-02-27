import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Firestore 초기화
let db;
try {
    if (!admin.apps.length) {
        let certObj;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
            const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
            certObj = JSON.parse(decoded);
        } else {
            const keyPath = path.join(rootDir, 'firebase-adminsdk.json');
            if (fs.existsSync(keyPath)) {
                certObj = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            }
        }
        
        if (certObj) {
            admin.initializeApp({ credential: admin.credential.cert(certObj) });
            db = admin.firestore();
        } else {
            console.warn("⚠️ Firebase Admin credentials not found. Cannot fetch recent news.");
        }
    } else {
        db = admin.firestore();
    }
} catch (e) {
    console.warn("⚠️ Firebase init failed:", e.message);
}

const GLOSSARY_PATH = path.join(rootDir, 'src/domains/glossary/application/glossary-data.js');

async function callGemini(systemInstruction, userPrompt) {
    const combinedPrompt = `${systemInstruction}\n\n[USER REQUEST]\n${userPrompt}`;
    const body = {
        contents: [{ parts: [{ text: combinedPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API Error');
    return data.candidates[0].content.parts.map(p => p.text).join('\n');
}

function extractJsonObject(text) {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("No JSON array found");
    }
    return cleaned.slice(start, end + 1);
}

async function extractNewTerms() {
    if (!GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY is missing.");
        process.exit(1);
    }

    console.log("🔍 Reading existing glossary...");
    let existingContent = fs.readFileSync(GLOSSARY_PATH, 'utf8');
    
    // 기존 단어 목록 추출 (중복 방지용)
    const existingIds = [];
    const idRegex = /id:\s*"([^"]+)"/g;
    let match;
    while ((match = idRegex.exec(existingContent)) !== null) {
        existingIds.push(match[1]);
    }
    console.log(`📦 Found ${existingIds.length} existing terms:`, existingIds.join(', '));

    let recentTexts = "";
    if (db) {
        console.log("📡 Fetching recent articles from Firestore...");
        const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').limit(5).get();
        snapshot.forEach(doc => {
            const data = doc.data();
            recentTexts += `\n--- 기사 제목: ${data.titleKo} ---\n${data.contentKo}\n`;
        });
    }

    if (!recentTexts) {
        console.error("❌ No recent articles found or Firestore not connected.");
        process.exit(1);
    }

    console.log("🤖 Asking Gemini to extract new terms...");
    const systemInstruction = `당신은 글로벌 기술 트렌드를 분석하는 '수석 테크 애널리스트'입니다.\n주어진 최근 뉴스 기사들을 읽고, 대중이 어려워할 만한 전문 기술/투자 용어를 정확히 3개만 추출하세요.`;

    const userPrompt = `
[기존에 이미 등록된 단어 목록 (절대 중복 추출 금지)]
${existingIds.join(', ')}

[최근 뉴스 기사 본문]
${recentTexts.substring(0, 10000)}

위 기사에서 기존 목록에 없는 새롭고 중요한 테크/투자 용어 딱 3개를 찾아 아래 JSON 배열 포맷으로 반환하세요.
반드시 투자자의 관점에서 아주 쉽고 재치 있게 설명해야 합니다.

결과 포맷 (반드시 유효한 JSON 배열로 출력):
[
  {
    "id": "영어알파벳식별자", 
    "term": "단어명 (영문약어)", 
    "category": "AI 기술 | 트렌드 | 반도체/하드웨어 | 투자", 
    "shortDesc": "20자 이내의 아주 쉽고 찰진 비유적 설명", 
    "longDesc": "해당 기술/용어의 정확한 뜻과 대중적인 설명 (3문장)", 
    "impact": "이 기술이 투자 관점에서 왜 돈이 되는지, 어떤 기업/산업에 영향을 미치는지 (2문장)"
  }
]`;

    try {
        const rawOutput = await callGemini(systemInstruction, userPrompt);
        const newTerms = JSON.parse(extractJsonObject(rawOutput));
        
        if (!Array.isArray(newTerms) || newTerms.length === 0) {
            throw new Error("Invalid output format from Gemini.");
        }

        console.log(`✨ Gemini generated ${newTerms.length} new terms! Injecting into file...`);

        // JS 객체 형식으로 텍스트 변환
        let injectionString = "";
        newTerms.forEach(term => {
            injectionString += `,
    {
        id: "${term.id}",
        term: "${term.term}",
        category: "${term.category}",
        shortDesc: "${term.shortDesc}",
        longDesc: "${term.longDesc}",
        impact: "${term.impact}"
    }`;
        });

        // 닫히는 대괄호 ] 앞에 새로운 데이터 주입
        const lastBracketIndex = existingContent.lastIndexOf(']');
        if (lastBracketIndex !== -1) {
            const updatedContent = existingContent.substring(0, lastBracketIndex) + injectionString + "\n" + existingContent.substring(lastBracketIndex);
            fs.writeFileSync(GLOSSARY_PATH, updatedContent, 'utf8');
            console.log("✅ Successfully appended new terms to glossary-data.js!");
            newTerms.forEach(t => console.log(` - ${t.term}`));
        } else {
            console.error("❌ Could not find closing bracket in glossary-data.js");
        }

    } catch (e) {
        console.error("🚨 Extraction failed:", e.message);
        process.exit(1);
    }
}

extractNewTerms();
