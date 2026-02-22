const fs = require('fs');
const path = require('path');
const { runPlanner, runDeveloper, runReviewer } = require('./agents');

/**
 * 프로젝트의 심층 맥락(Blueprint + 파일 내용)을 읽어오는 함수
 */
function getDeepProjectContext() {
    const rootDir = path.resolve(__dirname, '..');
    let context = "### Project Structure & Blueprint:\n";
    
    try {
        // 1. blueprint.md 읽기 (AI의 기억 장치)
        const blueprintPath = path.join(rootDir, 'blueprint.md');
        if (fs.existsSync(blueprintPath)) {
            context += "--- File: blueprint.md ---\n" + fs.readFileSync(blueprintPath, 'utf8') + "\n\n";
        }

        // 2. 파일 목록 확인
        const files = fs.readdirSync(rootDir);
        context += "### Current Root Files:\n" + files.join(', ') + "\n\n";

        // 3. 디자인 가이드들을 위한 핵심 파일 내용 읽기
        const criticalFiles = ['public/style.css', 'style.css', 'index.html'];
        context += "### Critical File Contents (for Style Matching):\n";
        
        criticalFiles.forEach(relPath => {
            const fullPath = path.join(rootDir, relPath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8').substring(0, 1000); 
                context += `\n--- File: ${relPath} ---\n${content}\n`;
            }
        });
        return context;
    } catch (err) {
        return "Context reading failed, proceed with caution.";
    }
}

/**
 * 최종 승인된 코드를 프로젝트 루트의 동적 기능 폴더에 직접 저장하는 함수
 */
function saveToProjectRoot(code, featureDirName) {
    const rootDir = path.resolve(__dirname, '..');
    const targetDir = path.join(rootDir, featureDirName);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`📁 프로젝트 루트에 새 기능 폴더 생성됨: ${featureDirName}`);
    }

    const codeBlocks = code.match(/```(?:[a-z]+)?\n([\s\S]*?)\n```/g);
    if (codeBlocks) {
        codeBlocks.forEach((block) => {
            const langMatch = block.match(/```([a-z]+)/);
            const lang = langMatch ? langMatch[1] : 'txt';
            const pureCode = block.replace(/```[a-z]*\n|```/g, '').trim();
            
            let name = `index.${lang}`;
            if (lang === 'html') name = 'index.html';
            if (lang === 'css') name = 'style.css';
            if (lang === 'javascript' || lang === 'js') name = 'main.js'; // 배포 관습 준수

            const finalPath = path.join(targetDir, name);
            fs.writeFileSync(finalPath, pureCode);
            console.log(`💾 루트 폴더 직배송 완료: ${featureDirName}/${name}`);
        });
    }
}

/**
 * 메인 오케스트레이터: 플래너 -> 개발자 <-> 리뷰어 루프 실행
 */
async function orchestrator(initialRequest) {
    console.log(`\n🚀 배포급 퀄리티를 위한 오케스트레이션 시작...`);
    const projectContext = getDeepProjectContext();
    
    const state = {
        initialRequest,
        projectContext,
        plan: null,
        code: null,
        review: { approved: false, comments: "" },
        history: [],
        folderName: 'ai-gen-feature' // 기본 폴더명
    };

    try {
        // 1. Planner가 전략 수립 및 폴더명 결정
        state.plan = await runPlanner(state, initialRequest, projectContext);
        
        // 플래너가 응답한 리스트에서 "folder: 이름" 형식을 찾아 폴더명 추출
        const folderStep = state.plan.find(step => step.toLowerCase().startsWith('folder:'));
        if (folderStep) {
            state.folderName = folderStep.split(':')[1].trim();
            console.log(`📂 Planner가 결정한 폴더명: ${state.folderName}`);
        }

        // 2. 완벽해질 때까지 반복하는 Self-Correction Loop (최대 3회)
        let attempts = 0;
        while (!state.review.approved && attempts < 3) {
            attempts++;
            console.log(`\n🔄 [시도 ${attempts}/3] 개발 및 검증 루프 가동...`);

            const developerInput = attempts > 1 
                ? `이전 코드 반려 사유: ${state.review.comments}\n\n위 피드백을 반영하여 코드를 수정해줘.` 
                : JSON.stringify(state.plan);

            state.code = await runDeveloper(state, projectContext + "\n" + developerInput);
            
            // 리뷰어가 깐깐하게 체크
            state.review = await runReviewer(state, projectContext);

            if (state.review.approved) {
                console.log(`\n✨ 에이전트 팀이 ${attempts}번 만에 완벽한 코드를 승인했습니다!`);
                break;
            } else {
                console.log(`⚠️ 리뷰 반려: ${state.review.comments}`);
            }
        }

        // 3. 최종 승인된 경우에만 루트로 저장
        if (state.review.approved) {
            saveToProjectRoot(state.code, state.folderName);
            console.log(`\n✅ 작업 완료! '${state.folderName}' 폴더가 생성되었습니다.`);
            console.log(`이제 'python main.py --build-only'를 실행해 배포하세요.`);
        } else {
            console.error("\n❌ 3회 시도 내에 완벽한 코드를 만들지 못했습니다.");
        }
    } catch (error) {
        console.error("\n❌ 시스템 에러 발생:", error);
    }
}

module.exports = orchestrator;