// multi-agent-system/orchestrator.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPlanner, runUIArchitect, runLogicEngineer, runIntegrator, runReviewer } from './agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function selectManuals(request) {
    const manualsDir = path.join(__dirname, 'manuals');
    let injectedManuals = "\n### 📚 Mandatory Project Rules (MUST FOLLOW):\n";
    const essential = ['index.md', 'project-conventions.md', 'css-baseline.md', 'web-components.md'];
    essential.forEach(file => {
        const filePath = path.join(manualsDir, file);
        if (fs.existsSync(filePath)) {
            injectedManuals += `--- Chapter: ${file} ---\n${fs.readFileSync(filePath, 'utf8')}\n`;
        }
    });
    return injectedManuals;
}

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
        // 1. Planning Stage
        state.plan = await runPlanner(state, userRequest, enrichedContext);
        console.log('✅ Plan Created:', state.plan);

        let folderName = 'new-feature';
        for (const step of state.plan) {
            if (typeof step === 'string' && step.toLowerCase().includes('folder:')) {
                folderName = step.split(':')[1].trim();
                break;
            } else if (typeof step === 'object' && step.folder) {
                folderName = step.folder;
                break;
            }
        }

        // 2. Specialized Coding & Self-Healing Loop
        while (state.iteration < state.maxIterations) {
            state.iteration++;
            console.log(`\n🔄 --- Workflow Iteration ${state.iteration}/${state.maxIterations} ---`);

            let iterationContext = enrichedContext;
            if (state.review.comments) {
                iterationContext += `\n\n### ⚠️ ATTENTION: PREVIOUS ATTEMPT REJECTED!`;
                iterationContext += `\n**Critical Issues to Fix**: ${state.review.comments}`;
                
                if (state.review.preserve) {
                    iterationContext += `\n**SUCCESSFUL PARTS TO PRESERVE (DO NOT CHANGE)**: ${state.review.preserve}`;
                    iterationContext += `\n**Reference for Preservation**: \n${state.bestUiSoFar}`;
                }
            }

            // 2a. UI Architect
            state.uiCode = await runUIArchitect(state, iterationContext);
            
            // 2b. Logic Engineer
            state.logicCode = await runLogicEngineer(state, iterationContext);

            // 2c. Integrator
            state.finalCode = await runIntegrator(state, iterationContext);

            // 3. Review
            state.review = await runReviewer(state.finalCode, iterationContext);
            
            // If the UI is getting better (or it's the first time), save it as the best reference
            if (state.iteration === 1 || (state.review.preserve && state.review.preserve.toLowerCase().includes('design'))) {
                state.bestUiSoFar = state.uiCode;
            }

            if (state.review.approved) {
                console.log(`✅ Approved on iteration ${state.iteration}!`);
                break;
            } else {
                console.log(`❌ Rejected. Comments: ${state.review.comments}`);
                if (state.review.preserve) console.log(`⭐ Preserving: ${state.review.preserve}`);
            }
        }

        // 4. Final Storage
        saveFiles(state.finalCode, folderName);
        console.log(`💾 Files saved to folder: ${folderName}`);

        return state;
    } catch (error) {
        console.error('❌ Workflow Critical Error:', error);
        throw error;
    }
}
