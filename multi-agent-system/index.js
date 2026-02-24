// multi-agent-system/index.js
import { executeWorkflow } from './orchestrator.js';

/**
 * [Work OS Entry Point]
 * 터미널에서 입력받은 인자를 미션으로 수행합니다.
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log("\n💡 [Ready] 수행할 미션이 없습니다.");
        return;
    }

    const userRequest = args.join(' ');
    const projectContext = "Root structure: animal_face_test, translations.js, common.js";

    console.log(`\n🎯 [Mission Start]: ${userRequest}`);
    
    try {
        await executeWorkflow(userRequest, projectContext);
        console.log(`\n✨ [Success] 미션 수행 완료.`);
    } catch (err) {
        console.error("\n❌ [Error] 미션 수행 중 오류 발생:", err);
        process.exit(1);
    }
}

main();
