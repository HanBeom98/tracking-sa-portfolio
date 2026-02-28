import { gameService } from "../application/gameService.js";
import { gameRenderer } from "../ui/gameRenderer.js";

function t(key, fallback) {
  return typeof window !== "undefined" && window.getTranslation
    ? window.getTranslation(key, fallback)
    : fallback;
}

async function handleShare(game) {
    const shareData = {
        title: `${game.title} | Tracking SA Games`,
        text: `${game.title} - Tracking SA에서 이 게임을 즐겨보세요!`,
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(window.location.href);
            alert(t('link_copied', '링크가 클립보드에 복사되었습니다.'));
        }
    } catch (err) {
        console.warn("[Share] Failed:", err);
    }
}

async function loadRelatedGames(currentCategory, currentGameId) {
    const listEl = document.getElementById("related-list");
    if (!listEl) return;

    try {
        const allGames = await gameService.getApprovedGames();
        let related = allGames.filter(g => g.category === currentCategory && g.id !== currentGameId);
        
        if (related.length < 4) {
            const others = allGames
                .filter(g => g.category !== currentCategory && g.id !== currentGameId)
                .sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
            related = [...related, ...others].slice(0, 4);
        } else {
            related = related.slice(0, 4);
        }

        if (related.length === 0) {
            const sec = document.getElementById("related-section");
            if (sec) sec.style.display = "none";
            return;
        }

        listEl.innerHTML = related.map(g => gameRenderer.renderMiniCard(g)).join("");
    } catch (e) {
        console.warn("[RelatedGames] Failed to load:", e);
        const sec = document.getElementById("related-section");
        if (sec) sec.style.display = "none";
    }
}

async function initPlayPage() {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get("id");

    if (!gameId) {
        window.location.href = "/games/";
        return;
    }

    const frame = document.getElementById("game-frame");
    const loader = document.getElementById("loading-indicator");

    try {
        const game = await gameService.getGame(gameId);
        if (!game) {
            alert("게임을 찾을 수 없습니다.");
            window.location.href = "/games/";
            return;
        }

        // 1. Load Game (Priority)
        if (frame) {
            frame.src = game.url;
            frame.onload = () => {
                if (loader) loader.style.display = "none";
                // Focus the iframe so user can start playing immediately
                try { frame.contentWindow.focus(); } catch (e) {}
            };
        }

        // 3. Prevent global scroll when arrow keys are pressed in the wrapper page
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                // If focus is NOT in an input/textarea, prevent scroll
                const active = document.activeElement.tagName.toLowerCase();
                if (active !== 'input' && active !== 'textarea') {
                    e.preventDefault();
                }
            }
        });

        // 2. Update UI Safely
        document.title = `${game.title} | Tracking SA`;
        
        const titleEl = document.getElementById("display-title");
        const authorEl = document.getElementById("display-author");
        const playsEl = document.getElementById("display-plays");
        const shareBtn = document.getElementById("share-btn");

        if (titleEl) titleEl.textContent = game.title;
        if (authorEl) authorEl.textContent = `By ${game.authorName}`;
        if (playsEl) playsEl.textContent = `${game.playCount} plays`;
        
        if (shareBtn) {
            shareBtn.onclick = () => handleShare(game);
        }

        loadRelatedGames(game.category, gameId);
        gameService.trackPlay(gameId).catch(e => console.warn("[PlayPage] Track failed", e));

    } catch (err) {
        console.error("[PlayPage] Init failed:", err);
        // Fallback for core games
        if (frame && !frame.src) {
            if (gameId === 'tetris') frame.src = '/games/tetris/';
            if (gameId === 'ai-evolution') frame.src = '/games/ai-evolution/';
        }
    }
}

initPlayPage();
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayPage);
}
