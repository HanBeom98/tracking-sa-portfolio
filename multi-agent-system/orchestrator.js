// multi-agent-system/orchestrator.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { runPlanner, runCreative, runDeveloper, runReviewer } from './agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * [1] Manuals Bootstrapping: 필수 지침서 자동 생성 및 로드
 */
function bootstrapManuals() {
    const manualsDir = path.join(__dirname, 'manuals');
    if (!fs.existsSync(manualsDir)) fs.mkdirSync(manualsDir, { recursive: true });

    const manualConfigs = [
        {
            file: 'index.md',
            content: `# Manual Index & Routing Rules\n\n이 폴더는 AI 에이전트가 준수해야 할 표준 기술 지침서입니다.\n\n## Routing Rules\n- **web-components**: \`index.html\` 수정 또는 신규 컴포넌트 생성 시 필수 포함.\n- **css-baseline**: \`style.css\` 수정 또는 디자인 작업 시 필수 포함.\n- **a11y**: 모든 UI 작업 시 필수 포함.\n- **project-conventions**: 모든 파일 저장 및 경로 결정 시 필수 포함.`
        },
        {
            file: 'a11y.md',
            content: `# Accessibility (A11Y) Manual\n\n- **Semantic**: \`main\`, \`section\`, \`article\`, \`nav\` 등 시맨틱 태그를 우선 사용하라.\n- **ARIA**: \`aria-label\`, \`role\`, \`aria-live\` 속성을 적절히 부여하라.\n- **Focus**: 키보드 내비게이션(\`tabindex\`) 및 포커스 상태 시각화가 되어야 한다.\n- **Images**: \`img\` 태그에는 반드시 의미 있는 \`alt\` 텍스트를 제공하라.`
        },
        {
            file: 'css-baseline.md',
            content: `# CSS Baseline & Modern Standards\n\n- **Color**: \`oklch(L C H)\` 또는 \`oklch(L C H / alpha)\` 형식을 기본으로 사용하라.\n- **Selectors**: \`:has()\` 선택자를 활용하여 부모 요소의 상태를 제어하라.\n- **Responsive**: \`@container\` 쿼리를 사용하여 컴포넌트 단위 반응형을 구현하라.\n- **Layout**: Logical Properties (\`margin-inline\`, \`padding-block\` 등)를 사용하라.\n- **Depth**: 다중 레이어 box-shadow를 사용하여 입체감을 표현하라.`
        },
        {
            file: 'project-conventions.md',
            content: `# Project Conventions Manual\n\n- **폴더 구조**: 신규 기능은 프로젝트 루트의 독립 폴더(예: \`/new-feature/\`)에 위치한다.\n- **파일명**:\n  - 메인 HTML: \`index.html\`\n  - 메인 CSS: \`style.css\` (또는 인라인)\n  - 메인 JS: \`script.js\`\n- **경로**: 모든 에셋과 스크립트 참조는 상대 경로를 사용하라.\n- **i18n**: \`translations.js\`와 \`window.getTranslation\`을 활용하여 다국어를 지원하라.`
        },
        {
            file: 'web-components.md',
            content: `# Web Components Manual (Custom Elements)\n\n- **상속**: \`HTMLElement\`를 상속받는 class를 생성하라.\n- **캡슐화**: \`this.attachShadow({ mode: 'open' })\`를 사용하여 스타일을 격리하라.\n- **정의**: \`customElements.define('tag-name', ClassName)\`를 파일 하단에 배치하라.\n- **연동**: 외부에서 설정(i18n 등)을 주입받을 수 있도록 설계하라.`
        }
    ];

    manualConfigs.forEach(cfg => {
        const filePath = path.join(manualsDir, cfg.file);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, cfg.content);
            console.log(`🆕 Manual created: ${cfg.file}`);
        }
    });
}

function selectManuals(request) {
    bootstrapManuals();
    const manualsDir = path.join(__dirname, 'manuals');
    let injectedManuals = "\n### 📚 주입된 매뉴얼 (Mandatory Rules):\n";
    const requestLower = request.toLowerCase();
    const selectedFiles = new Set();
    
    const mappings = [
        { keywords: ['component', 'web', 'shadow', '컴포넌트', '웹컴포넌트'], file: 'web-components.md' },
        { keywords: ['color', 'style', 'design', 'css', '디자인', '스타일'], file: 'css-baseline.md' },
        { keywords: ['a11y', 'access', 'accessibility', 'alt', '접근성'], file: 'a11y.md' },
        { keywords: ['project', 'rule', 'folder', 'convention', '프로젝트', '규칙', '폴더'], file: 'project-conventions.md' },
        { keywords: ['planner', 'strategy', '기획', '전략'], file: 'planner.md' },
        { keywords: ['developer', 'engineer', '개발', '엔지니어'], file: 'developer.md' },
        { keywords: ['reviewer', 'audit', '검수', '감사'], file: 'reviewer.md' },
        { keywords: ['creative', 'ux', 'design', 'director', '크리에이티브', '디자인'], file: 'creative.md' },
        { keywords: ['fix', 'bug', 'error', 'maintenance', 'repair', '고치기', '수정', '보수', '에러'], file: 'maintainer.md' }
    ];

    // Always include index & lessons learned (Knowledge Base)
    const alwaysInclude = ['index.md', 'lessons-learned.md'];
    alwaysInclude.forEach(file => {
        const filePath = path.join(manualsDir, file);
        if (fs.existsSync(filePath)) {
            injectedManuals += `--- Chapter: ${file} ---\n${fs.readFileSync(filePath, 'utf8')}\n`;
            selectedFiles.add(file);
        }
    });

    mappings.forEach(m => {
        if (m.keywords.some(k => requestLower.includes(k)) && !selectedFiles.has(m.file)) {
            const filePath = path.join(manualsDir, m.file);
            if (fs.existsSync(filePath)) {
                injectedManuals += `--- Chapter: ${m.file} ---\n${fs.readFileSync(filePath, 'utf8')}\n`;
                selectedFiles.add(m.file);
            }
        }
    });
    return injectedManuals;
}

function normalizePlan(rawPlan) {
    if (!Array.isArray(rawPlan)) {
        throw new Error('Planner output must be an array.');
    }

    const normalized = rawPlan
        .map(step => String(step || '').trim())
        .filter(Boolean);

    if (normalized.length === 0) {
        throw new Error('Planner produced an empty plan.');
    }

    if (!normalized.some(step => step.toLowerCase().startsWith('folder:'))) {
        normalized.unshift('folder: ai-gen-feature');
    }

    return normalized;
}

function normalizeFolderName(folderName) {
    const safe = folderName
        .toLowerCase()
        .replace(/[^a-z0-9-_/]/g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/\/+/g, '/')
        .replace(/^\//, '')
        .trim();

    if (!safe || safe.includes('..')) {
        return 'ai-gen-feature';
    }

    return safe;
}

/**
 * [2] Code Block Parser & Storage: 언어 태그 기반 정밀 저장
 */
function saveFiles(code, featureDirName) {
    const rootDir = path.resolve(__dirname, '..');
    const targetDir = path.join(rootDir, featureDirName);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const extractions = { html: null, css: null, js: null };
    const markers = [
        { tag: '```html', end: '```', type: 'html' },
        { tag: '```css', end: '```', type: 'css' },
        { tag: '```javascript', end: '```', type: 'js' },
        { tag: '```js', end: '```', type: 'js' }
    ];

    markers.forEach(m => {
        if (extractions[m.type]) return; // Use first occurrence only
        const startIdx = code.indexOf(m.tag);
        if (startIdx !== -1) {
            const contentStart = startIdx + m.tag.length;
            const endIdx = code.indexOf(m.end, contentStart);
            if (endIdx !== -1) {
                extractions[m.type] = code.substring(contentStart, endIdx).trim();
            }
        }
    });

    // 최소 하나 이상의 코드 블록이 있는지 확인 (전체 누락 시에만 에러)
    if (!extractions.html && !extractions.css && !extractions.js) {
        throw new Error("❌ Critical: No valid HTML, CSS, or JS code blocks found in the AI response.");
    }

    const saved = [];
    if (extractions.html) { fs.writeFileSync(path.join(targetDir, 'index.html'), extractions.html); saved.push('index.html'); }
    if (extractions.css) { fs.writeFileSync(path.join(targetDir, 'style.css'), extractions.css); saved.push('style.css'); }
    if (extractions.js) { fs.writeFileSync(path.join(targetDir, 'script.js'), extractions.js); saved.push('script.js'); }

    console.log(`[Storage] Saved to /${featureDirName}: ${saved.join(', ')}`);
    return extractions;
}

/**
 * [3] Build Validation: 유연한 Python 환경 대응
 */
function validateBuild() {
    const rootDir = path.resolve(__dirname, '..');
    const pythonPaths = [
        process.env.PYTHON_EXECUTABLE,
        'python3',
        'python',
        path.join(rootDir, 'venv/bin/python'),
        path.join(rootDir, '.venv/bin/python')
    ].filter(Boolean);

    let lastLog = "";
    let lastTraceback = "";
    let success = false;
    let usedPy = "";

    for (const py of pythonPaths) {
        try {
            const output = execSync(`${py} main.py --build-only`, { stdio: 'pipe', cwd: rootDir }).toString();
            lastLog = output;
            success = true;
            usedPy = py;
            break;
        } catch (err) {
            lastLog = err.stdout ? err.stdout.toString() : "";
            const stderr = err.stderr ? err.stderr.toString() : "";
            lastTraceback = stderr;
            usedPy = py;
        }
    }

    const truncatedLog = lastLog.slice(-2000);
    const tracebackSummary = lastTraceback.split('\n').slice(-40).join('\n');

    return { success, log: truncatedLog, tracebackSummary, pythonUsed: usedPy };
}

/**
 * [4] Post-Flight QC: 정적 분석 및 의미론 검사
 */
function postFlightCheck(extractions) {
    const { html, css, js } = extractions;
    const results = {
        hasHtml: !!html,
        hasCss: !!css,
        hasJs: !!js,
        hasSemantic: /<(main|section|nav|article)/i.test(html || ""),
        missingAlt: /<img(?![^>]*\balt=)[^>]*>/i.test(html || ""),
        hasFocusVisible: /:focus-visible/i.test(css || "")
    };

    const build = validateBuild();
    
    // Summary 형식 개선
    const staticStatus = (results.hasHtml && results.hasCss && results.hasJs) ? "PASS html/css/js" : "FAIL";
    const semanticStatus = results.hasSemantic ? "OK" : "MISS";
    const altStatus = results.missingAlt ? "ERR" : "OK";
    const focusStatus = results.hasFocusVisible ? "OK" : "MISS";

    const summary = `Static: ${staticStatus} | Semantic: ${semanticStatus} | Alt: ${altStatus} | Focus: ${focusStatus}`;

    return { json: { ...results, build }, summary };
}

/**
 * [5] Work Memory: 작업 기록 및 체크리스트 관리
 */
function updateWorkDocs(featureName, state, qcReport, approved) {
    const rootDir = path.resolve(__dirname, '..');
    const workDir = path.join(rootDir, 'workdocs', featureName);
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

    // 1. Plan & Context (Overwrite)
    fs.writeFileSync(path.join(workDir, 'plan.md'), `# Plan: ${featureName}\n\n${JSON.stringify(state.plan, null, 2)}`);
    fs.writeFileSync(path.join(workDir, 'context.md'), `# Context: ${featureName}\n\n${qcReport.summary}\n\n${JSON.stringify(qcReport.json, null, 2)}`);

    // 2. Build Log (Always write)
    const buildInfo = qcReport.json.build;
    fs.writeFileSync(
        path.join(workDir, 'build.log'),
        `Python Used: ${buildInfo.pythonUsed}\n\n` +
        buildInfo.log + '\n\n' + 
        (buildInfo.tracebackSummary || '')
    );

    // 3. Checklist (Preserve & Update)
    const checklistPath = path.join(workDir, 'checklist.md');
    let content = fs.existsSync(checklistPath) ? fs.readFileSync(checklistPath, 'utf8') : "- [ ] Step 1: Design\n- [ ] Step 2: Implementation\n- [ ] Step 3: Optimization\n\n### 🚩 Feedback History\n";

    if (approved) {
        // Mark 1-2 items as [x]
        let marked = 0;
        content = content.replace(/- \[ \]/g, (match) => {
            if (marked < 2) { marked++; return "- [x]"; }
            return match;
        });
    } else {
        // Append Feedback
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const feedback = state.review?.comments || "No specific comments.";
        content += `- [${timestamp}] ${feedback}\n`;
    }

    fs.writeFileSync(checklistPath, content);
}

/**
 * [Main] Orchestrator: AI 작업 운영체계 (Work OS)
 */
export async function orchestrator(initialRequest) {
    console.log(`\n🚀 [Work OS] Stabilized Orchestrator Starting...`);
    const rootDir = path.resolve(__dirname, '..');
    const blueprintPath = path.join(rootDir, 'blueprint.md');
    const blueprint = fs.existsSync(blueprintPath) ? fs.readFileSync(blueprintPath, 'utf8') : "No blueprint found.";
    const manuals = selectManuals(initialRequest);
    
    const state = {
        initialRequest,
        plan: null,
        code: null,
        creativeSpec: null,
        review: { approved: false, comments: "" },
        folderName: 'ai-gen-feature',
        existingContext: ""
    };

    try {
        // 1. Planner
        state.plan = normalizePlan(await runPlanner(state, initialRequest, blueprint));
        const folderStep = state.plan.find(s => s.toLowerCase().startsWith('folder:'));
        if (folderStep) {
            const suggestedFolder = normalizeFolderName(folderStep.split(':')[1].trim());
            const fullPath = path.join(rootDir, suggestedFolder);
            
            // 경로 감지 및 기존 코드 컨텍스트 확보 로직
            if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
                console.log(`📂 [Path Detection] Existing folder found: /${suggestedFolder}. Reading context...`);
                let context = `\n\n[EXISTING_CODE_CONTEXT] for /${suggestedFolder}:\n`;
                
                const filesToRead = ['index.html', 'script.js', 'style.css'];
                filesToRead.forEach(file => {
                    const filePath = path.join(fullPath, file);
                    if (fs.existsSync(filePath)) {
                        const ext = path.extname(file).slice(1);
                        const lang = ext === 'js' ? 'javascript' : ext;
                        context += `--- ${file} ---\n\`\`\`${lang}\n${fs.readFileSync(filePath, 'utf8')}\n\`\`\`\n`;
                    }
                });
                
                state.existingContext = context + `위 내용을 바탕으로 필요한 부분만 수정하거나 추가하라.`;
            } else {
                console.log(`🆕 [Path Detection] New feature folder: /${suggestedFolder}`);
            }
            state.folderName = suggestedFolder;
        }

        // 2. Main Loop (Max 3 attempts)
        let attempts = 0;
        while (!state.review.approved && attempts < 3) {
            attempts++;
            console.log(`\n🔄 [Attempt ${attempts}/3] Corporate Workflow cycle...`);

            // 2-1. Creative Strategy (NEW)
            console.log('🎨 [Corporate Flow] Creative Director designing UX & SEO...');
            const creativeContext = `[PLAN]: ${JSON.stringify(state.plan)}\n[CONTEXT]: ${state.existingContext}`;
            state.creativeSpec = await runCreative(state, blueprint + manuals + creativeContext);

            // Developer 출력 강제 규칙 주입
            const forceRules = `\n\n반드시 \`\`\`html, \`\`\`css, \`\`\`js (또는 \`\`\`javascript) 세 개의 코드블록을 모두 출력하라.\n변경이 없는 파일도 이전 내용을 그대로 재출력하라.\n3개 중 하나라도 누락되면 실패로 간주된다.`;
            const developerInput = `[DESIGN_SPEC]: ${state.creativeSpec}\n[PLAN]: ${JSON.stringify(state.plan)}\n[FEEDBACK]: ${state.review.comments || 'None'}${state.existingContext}${forceRules}`;
            
            state.code = await runDeveloper(state, blueprint + manuals + "\n" + developerInput);
            
            // Always save results from Developer
            const extractions = saveFiles(state.code, state.folderName);
            
            // Post-Flight & QC
            const qcReport = postFlightCheck(extractions);
            console.log(`🔍 ${qcReport.summary}`);

            // Reviewer
            state.review = await runReviewer(state.code, blueprint + manuals + qcReport.summary);
            
            // Work Memory update
            updateWorkDocs(state.folderName, state, qcReport, state.review.approved);

            if (state.review.approved) break;
        }

        if (state.review.approved) {
            console.log(`\n✅ [MISSION COMPLETE] /${state.folderName} deployment successful.`);
            
            // 3. Update blueprint.md with activity log
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const logEntry = `\n- [${timestamp}] Feature updated: ${state.folderName} (Request: ${state.initialRequest.substring(0, 50)}...)`;
            fs.appendFileSync(blueprintPath, logEntry);
            console.log(`📝 [Blueprint] Activity logged.`);
        } else {
            console.error(`\n❌ [FAIL] Quality standards not met after 3 attempts.`);
        }

    } catch (error) {
        console.error(`\n❌ [SYSTEM ERROR]`, error);
    }
}
