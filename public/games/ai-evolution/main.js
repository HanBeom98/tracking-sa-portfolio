import { AIEvolution2048 } from "./application/ai-evolution-game.js";
import { initAiEvolutionFirebase } from "./infra/firebase-runtime.js";

/**
 * AI Evolution 2048 부트스트랩 (UI Layer)
 * UI 계층에서 DOM 요소를 확보하고 Application 계층에 주입합니다.
 */
async function bootstrap() {
    try {
        // 1. 인프라 초기화
        initAiEvolutionFirebase();

        // 2. DOM 준비 대기
        if (document.readyState === "loading") {
            await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve));
        }

        // 3. 필수 UI 요소 확보 (이 계층의 책임)
        const findElements = () => ({
            tileLayer: document.getElementById('tile-layer'),
            scoreElem: document.getElementById('current-score'),
            bestElem: document.getElementById('best-score'),
            undoBtn: document.getElementById('undo-btn'),
            statusMsg: document.getElementById('status-message'),
            modal: document.getElementById('game-over-modal'),
            mainControls: document.querySelector('.main-controls')
        });

        const start = () => {
            const elements = findElements();
            
            // 필수 요소인 tileLayer가 없으면 다음 프레임에서 재시도 (UI 계층의 스케줄링)
            if (!elements.tileLayer) {
                requestAnimationFrame(start);
                return;
            }

            console.log("🚀 Initializing AI Evolution 2048 with Dependency Injection...");
            window.gameInstance = new AIEvolution2048(elements);
        };

        requestAnimationFrame(start);

    } catch (error) {
        console.error("❌ Failed to bootstrap game:", error);
    }
}

bootstrap();
