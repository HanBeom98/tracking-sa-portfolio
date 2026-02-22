// multi-agent-system/index.js
import { orchestrator } from './orchestrator.js';

/**
 * [Work OS Entry Point]
 * 터미널에서 입력받은 인자를 미션으로 수행합니다.
 * 예: node multi-agent-system/index.js "신규 컴포넌트 생성"
 */
async function main() {
    const args = process.argv.slice(2);
    
    // 1. 터미널 인자가 있으면 그것을 사용, 없으면 대기 상태 메시지 출력
    if (args.length === 0) {
        console.log("\n💡 [Ready] 수행할 미션이 없습니다.");
        console.log("사용법: node multi-agent-system/index.js \"미션 내용을 여기에 작성\"");
        return;
    }

    const userRequest = args.join(' ');

    console.log(`\n🎯 [Mission Start]: ${userRequest}`);
    
    try {
        await orchestrator(userRequest);
        console.log(`\n✨ [Success] 미션 수행 완료 및 시스템 초기화됨.`);
    } catch (err) {
        console.error("\n❌ [Error] 미션 수행 중 오류 발생:", err);
        process.exit(1);
    }
}

main().catch(err => {
    console.error("Fatal Error in Main:", err);
    process.exit(1);
});
