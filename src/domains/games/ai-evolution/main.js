import { AIEvolution2048 } from "./application/ai-evolution-game.js";
import { initAiEvolutionFirebase } from "./infra/firebase-runtime.js";

/**
 * AI Evolution 2048 부트스트랩
 * DOM이 완전히 준비되고 주입된 헤더/푸터가 정착된 후 게임을 실행합니다.
 */
async function bootstrap() {
    try {
        // Firebase 초기화 (인프라 레이어)
        initAiEvolutionFirebase();

        // DOM 준비 대기
        if (document.readyState === "loading") {
            await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve));
        }

        // 브라우저 렌더링 사이클 대기 (ID를 확실히 찾기 위함)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                console.log("🚀 Initializing AI Evolution 2048...");
                window.gameInstance = new AIEvolution2048();
            });
        });
    } catch (error) {
        console.error("❌ Failed to bootstrap game:", error);
    }
}

bootstrap();
