// multi-agent-system/orchestrator.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPlanner, runUIArchitect, runLogicEngineer, runIntegrator, runReviewer } from './agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * [1] Manuals Bootstrapping: 필수 지침서 로드 및 관리
 */
function selectManuals(request) {
    const manualsDir = path.join(__dirname, 'manuals');
    let injectedManuals = "\n### 📚 Mandatory Project Rules (MUST FOLLOW):\n";
    const requestLower = request.toLowerCase();
    
    // Always include core conventions
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
 * [2] Code Block Parser & Storage: 분리된 전문가들의 결과물을 저장
 */
function saveFiles(code, folderName) {
    const rootDir = path.resolve(__dirname, '..');
    const targetDir = path.join(rootDir, folderName);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const extractions = { html: null, css: null, js: null };
    const markers = [
        { tag: '```html', type: 'html' },
        { tag: '```css', type: 'css' },
        { tag: '```javascript', type: 'js' },
        { tag: '```js', type: 'js' }
    ];

    markers.forEach(m => {
        const startIdx = code.indexOf(m.tag);
        if (startIdx !== -1) {
            const contentStart = startIdx + m.tag.length;
            const endIdx = code.indexOf('```', contentStart);
            if (endIdx !== -1) {
                extractions[m.type] = code.substring(contentStart, endIdx).trim();
            }
        }
    });

    if (extractions.html) fs.writeFileSync(path.join(targetDir, 'index.html'), extractions.html);
    if (extractions.css) fs.writeFileSync(path.join(targetDir, 'style.css'), extractions.css);
    if (extractions.js) fs.writeFileSync(path.join(targetDir, 'script.js'), extractions.js);
    
    return extractions;
}

/**
 * [3] Execute Workflow: Specialized Coding Team Pipeline
 */
export async function executeWorkflow(userRequest, projectContext) {
    const manuals = selectManuals(userRequest);
    const enrichedContext = `${projectContext}\n${manuals}`;

    let state = {
        request: userRequest,
        plan: null,
        uiCode: '',
        logicCode: '',
        finalCode: '',
        review: null
    };

    try {
        // 1. Planning
        state.plan = await runPlanner(state, userRequest, enrichedContext);
        console.log('✅ Plan Created:', state.plan);

        // Extract folder name from plan (e.g., "folder: ai-test")
        const folderStep = state.plan.find(s => s.toLowerCase().startsWith('folder:'));
        const folderName = folderStep ? folderStep.split(':')[1].trim() : 'new-feature';

        // 2. Specialized Coding
        
        // 2a. UI Architect (Design)
        state.uiCode = await runUIArchitect(state, enrichedContext);
        console.log('✅ UI/UX Architecture Completed.');

        // 2b. Logic Engineer (Functionality)
        state.logicCode = await runLogicEngineer(state, enrichedContext);
        console.log('✅ Logic Engineering Completed.');

        // 2c. System Integrator (Final Assembly)
        state.finalCode = await runIntegrator(state, enrichedContext);
        console.log('✅ System Integration Completed.');

        // 3. Storage
        saveFiles(state.finalCode, folderName);
        console.log(`💾 Files saved to folder: ${folderName}`);

        // 4. Review
        state.review = await runReviewer(state.finalCode, enrichedContext);
        console.log('✅ Review Completed:', state.review.approved ? 'APPROVED' : 'REJECTED');

        return state;
    } catch (error) {
        console.error('❌ Workflow Error:', error);
        throw error;
    }
}
