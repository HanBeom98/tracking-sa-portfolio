// multi-agent-system/orchestrator.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPlanner, runUIArchitect, runLogicEngineer, runIntegrator, runReviewer } from './agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function selectManuals(request) {
    const manualsDir = path.join(__dirname, 'manuals');
    let injectedManuals = "\n### 📚 Mandatory Project Rules:\n";
    const essential = ['index.md', 'project-conventions.md', 'css-baseline.md', 'web-components.md'];
    essential.forEach(file => {
        const filePath = path.join(manualsDir, file);
        if (fs.existsSync(filePath)) {
            injectedManuals += `--- Chapter: ${file} ---\n${fs.readFileSync(filePath, 'utf8')}\n`;
        }
    });
    return injectedManuals;
}

/**
 * [Robust Parser] AI가 뱉은 코드 블록에서 파일명과 경로를 지능적으로 추출하여 저장
 */
function saveFiles(code, defaultFolder) {
    const rootDir = path.resolve(__dirname, '..');
    const blocks = code.match(/```(?:html|css|js|javascript)[\s\S]*?```/g) || [];
    
    blocks.forEach(block => {
        const lines = block.split('\n');
        // 파일명 힌트 찾기 (예: /* news/style.css */ 또는 <!-- news/index.html -->)
        const hintMatch = block.match(/(?:\/\*|<!--)\s*([a-zA-Z0-9._\-\/]+)\s*(?:\*\/|-->)/);
        let fileName = hintMatch ? hintMatch[1].trim() : '';
        
        // 블록 타입별 기본 파일명 결정
        if (!fileName) {
            if (block.includes('```html')) fileName = 'index.html';
            else if (block.includes('```css')) fileName = 'style.css';
            else fileName = 'script.js';
        }

        const cleanCode = lines.slice(1, -1).join('\n').trim();
        const targetPath = path.join(rootDir, fileName.includes('/') ? fileName : path.join(defaultFolder, fileName));
        
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, cleanCode);
        console.log(`💾 Saved: ${targetPath}`);
    });
}

/**
 * [Robust Review] 리뷰어의 응답이 불규칙해도 피드백을 정확히 추출
 */
function normalizeReview(review) {
    if (typeof review !== 'object') return { approved: false, comments: 'Invalid review format' };
    return {
        approved: !!(review.approved || review.isApproved),
        comments: review.comments || review.feedback || review.reason || 'No specific comments provided.',
        preserve: review.preserve || review.good_parts || ''
    };
}

export async function executeWorkflow(userRequest, projectContext) {
    const manuals = selectManuals(userRequest);
    let enrichedContext = `${projectContext}\n${manuals}`;

    let state = {
        request: userRequest,
        plan: null,
        uiCode: '',
        logicCode: '',
        finalCode: '',
        review: { approved: false, comments: '', preserve: '' },
        iteration: 0,
        maxIterations: 3,
        bestUiSoFar: ''
    };

    try {
        state.plan = await runPlanner(state, userRequest, enrichedContext);
        let folderName = 'new-feature';
        for (const step of state.plan) {
            if (typeof step === 'string' && step.toLowerCase().includes('folder:')) {
                folderName = step.split(':')[1].trim(); break;
            } else if (typeof step === 'object' && step.folder) {
                folderName = step.folder; break;
            }
        }

        while (state.iteration < state.maxIterations) {
            state.iteration++;
            console.log(`\n🔄 --- Workflow Iteration ${state.iteration}/${state.maxIterations} ---`);

            let iterationContext = enrichedContext;
            if (state.review.comments && state.review.comments !== 'No specific comments provided.') {
                iterationContext += `\n\n### ⚠️ PREVIOUS ATTEMPT REJECTED!\n**Issues to Fix**: ${state.review.comments}`;
                if (state.review.preserve) {
                    iterationContext += `\n**SUCCESSFUL PARTS (KEEP THESE)**: ${state.review.preserve}\n**Reference**: \n${state.bestUiSoFar}`;
                }
            }

            state.uiCode = await runUIArchitect(state, iterationContext);
            state.logicCode = await runLogicEngineer(state, iterationContext);
            state.finalCode = await runIntegrator(state, iterationContext);

            const rawReview = await runReviewer(state.finalCode, iterationContext);
            state.review = normalizeReview(rawReview);
            
            if (state.iteration === 1 || (state.review.preserve && state.review.preserve.toLowerCase().includes('design'))) {
                state.bestUiSoFar = state.uiCode;
            }

            if (state.review.approved) {
                console.log(`✅ Approved on iteration ${state.iteration}!`);
                break;
            } else {
                console.log(`❌ Rejected: ${state.review.comments}`);
            }
        }

        saveFiles(state.finalCode, folderName);
        return state;
    } catch (error) {
        console.error('❌ Workflow Critical Error:', error);
        throw error;
    }
}
