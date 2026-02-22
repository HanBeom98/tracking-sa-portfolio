const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { runPlanner, runDeveloper, runReviewer } = require('./agents');

/**
 * [1] Manual Router: 현재 요청에 필요한 매뉴얼 챕터만 선택하여 주입
 */
function selectManuals(request) {
    const manualsDir = path.join(__dirname, 'manuals');
    let injectedManuals = "\n### 📚 주입된 매뉴얼 (Mandatory Rules):\n";
    
    try {
        if (!fs.existsSync(manualsDir)) fs.mkdirSync(manualsDir);
        
        // 키워드별 매뉴얼 매핑
        const mappings = [
            { keywords: ['color', 'style', 'design', 'css'], file: 'css-baseline.md' },
            { keywords: ['component', 'web', 'shadow'], file: 'web-components.md' },
            { keywords: ['project', 'rule', 'folder'], file: 'project-conventions.md' }
        ];

        mappings.forEach(m => {
            const hasKeyword = m.keywords.some(k => request.toLowerCase().includes(k));
            const filePath = path.join(manualsDir, m.file);
            if (hasKeyword && fs.existsSync(filePath)) {
                injectedManuals += `--- Chapter: ${m.file} ---\n${fs.readFileSync(filePath, 'utf8')}\n`;
            }
        });
    } catch (err) {
        console.warn("⚠️ 매뉴얼 로딩 중 오류 발생:", err.message);
    }
    return injectedManuals;
}

/**
 * [3] Work Memory: 작업 기억 3문서 (Plan, Context, Checklist) 생성 및 업데이트
 */
function updateWorkDocs(featureName, planData, contextData, checklistData) {
    const workDir = path.resolve(__dirname, '..', 'workdocs', featureName);
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

    fs.writeFileSync(path.join(workDir, 'plan.md'), `# Plan: ${featureName}\n\n${planData}`);
    fs.writeFileSync(path.join(workDir, 'context.md'), `# Context: ${featureName}\n\n${contextData}`);
    fs.writeFileSync(path.join(workDir, 'checklist.md'), `# Checklist: ${featureName}\n\n${checklistData}`);
    
    console.log(`📝 WorkDocs 기록 완료: /workdocs/${featureName}/`);
}

/**
 * [4, 5] Post-Flight: 자동 정적 검사 및 빌드 테스트
 */
function runAutomationCheck(code) {
    let report = "\n### 🔍 [QC Report: Automated Inspection]\n";
    
    // 1. 정적 분석
    const checks = [
        { label: "Shadow DOM 사용", regex: /attachShadow/ },
        { label: "Web Component 정의", regex: /customElements\.define/ },
        { label: "OKLCH 컬러 사용", regex: /oklch/ },
        { label: "HTML/CSS/JS 블록 포함", regex: /```html[\s\S]*```css[\s\S]*```javascript/i }
    ];

    checks.forEach(c => {
        const pass = c.regex.test(code);
        report += `${pass ? '✅' : '❌'} ${c.label}\n`;
    });

    // 2. 빌드 테스트 (python main.py --build-only)
    try {
        console.log("🛠️ 빌드 테스트 실행 중 (python main.py)...");
        const buildOutput = execSync('python main.py --build-only', { stdio: 'pipe' }).toString();
        report += "✅ 빌드 테스트: SUCCESS\n";
    } catch (err) {
        report += `❌ 빌드 테스트: FAILED\n- Error: ${err.stderr ? err.stderr.toString() : err.message}\n`;
    }

    return report;
}

/**
 * 프로젝트 맥락 읽기 (기존 유지)
 */
function getDeepProjectContext() {
    const rootDir = path.resolve(__dirname, '..');
    let context = "### Project Structure & Blueprint:\n";
    const blueprintPath = path.join(rootDir, 'blueprint.md');
    if (fs.existsSync(blueprintPath)) {
        context += fs.readFileSync(blueprintPath, 'utf8') + "\n";
    }
    return context;
}

/**
 * 최종 코드 저장 (기존 유지)
 */
function saveToProjectRoot(code, featureDirName) {
    const rootDir = path.resolve(__dirname, '..');
    const targetDir = path.join(rootDir, featureDirName);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const codeBlocks = code.match(/```(?:[a-z]+)?\n([\s\S]*?)\n```/g);
    if (codeBlocks) {
        codeBlocks.forEach((block) => {
            const langMatch = block.match(/```([a-z]+)/);
            const lang = langMatch ? langMatch[1] : 'txt';
            const pureCode = block.replace(/```[a-z]*\n|```/g, '').trim();
            const name = lang === 'html' ? 'index.html' : (lang === 'css' ? 'style.css' : 'main.js');
            fs.writeFileSync(path.join(targetDir, name), pureCode);
            console.log(`💾 저장 완료: ${featureDirName}/${name}`);
        });
    }
}

/**
 * Main Orchestrator: AI 작업 운영체계 (Work OS)
 */
async function orchestrator(initialRequest) {
    console.log(`\n🚀 [Work OS] 고도화된 에이전트 루프 가동 시작...`);
    const projectContext = getDeepProjectContext();
    const manuals = selectManuals(initialRequest);
    
    const state = {
        initialRequest,
        projectContext,
        plan: null,
        code: null,
        review: { approved: false, comments: "" },
        folderName: 'ai-gen-feature'
    };

    try {
        // 1. Planner 단계 & WorkDocs 초기화
        state.plan = await runPlanner(state, initialRequest, projectContext);
        const folderStep = state.plan.find(step => step.toLowerCase().startsWith('folder:'));
        if (folderStep) state.folderName = folderStep.split(':')[1].trim();

        // 2. Self-Correction Loop
        let attempts = 0;
        while (!state.review.approved && attempts < 3) {
            attempts++;
            console.log(`\n🔄 [시도 ${attempts}/3] 개발 및 자동 검수 진행 중...`);

            // Developer 실행 (매뉴얼 + 체크포인트 주입)
            const developerInput = `
[GOAL]: ${JSON.stringify(state.plan)}
[FEEDBACK]: ${state.review.comments || 'None'}
[MEMORY]: 현재 /workdocs/${state.folderName}/ 문서를 참조하여 작업하십시오.
`.trim();

            state.code = await runDeveloper(state, projectContext + manuals + "\n" + developerInput);
            
            // Post-Flight: 자동 검수 및 빌드 리포트 생성
            const qcReport = runAutomationCheck(state.code);
            console.log(qcReport);

            // Reviewer 실행 (QC 리포트 기반 승인)
            state.review = await runReviewer(state, projectContext + qcReport);

            // 작업 기억 업데이트
            updateWorkDocs(
                state.folderName, 
                JSON.stringify(state.plan, null, 2),
                `Attempt ${attempts}: ${state.review.approved ? 'Approved' : 'Rejected'}`,
                `- Task execution: ${attempts} times\n- Last QC Report: ${qcReport.replace(/\n/g, ' ')}`
            );

            if (state.review.approved) break;
        }

        // 3. 배포
        if (state.review.approved) {
            saveToProjectRoot(state.code, state.folderName);
            console.log(`\n✅ [MISSION COMPLETE] 모든 검수를 통과하여 배포되었습니다.`);
        } else {
            console.error("\n❌ [FAIL] 3회 시도 내에 품질 기준을 충족하지 못했습니다.");
        }
    } catch (error) {
        console.error("\n❌ 시스템 에러:", error);
    }
}

module.exports = orchestrator;