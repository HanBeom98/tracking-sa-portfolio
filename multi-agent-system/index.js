// multi-agent-system/index.js
import { orchestrator } from './orchestrator.js';

async function main() {
    const args = process.argv.slice(2);
    // 터미널 인자가 없으면 기본 메시지, 있으면 인자를 요청으로 사용
    const userRequest = args.length > 0 ? args.join(' ') : "기존 기능 점검 및 최적화";

    console.log(`\n🎯 미션 수령: ${userRequest}`);
    await orchestrator(userRequest);
}

main().catch(err => {
    console.error("Fatal Error in Main:", err);
    process.exit(1);
});
