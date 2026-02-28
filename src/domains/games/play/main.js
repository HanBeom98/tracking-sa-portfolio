import { getGameById, incrementPlayCount, fetchGames } from "../application/game-hub-service.js";

function t(key, fallback) {
  return typeof window !== "undefined" && window.getTranslation
    ? window.getTranslation(key, fallback)
    : fallback;
}

function renderMiniCard(game) {
    return `
        <a href="/games/play/?id=${game.id}" style="text-decoration:none; display:flex; flex-direction:column; background:white; border-radius:12px; overflow:hidden; border:1px solid oklch(92% 0.02 260); transition:transform 0.2s;">
            <div style="width:100%; aspect-ratio:16/9; background:oklch(96% 0.01 250); display:flex; justify-content:center; align-items:center;">
                <img src="${game.thumbnail || '/favicon.svg'}" style="width:30px; opacity:0.5;" onerror="this.src='/favicon.svg'">
            </div>
            <div style="padding:12px;">
                <h4 style="margin:0; font-size:0.9rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${game.title}</h4>
                <p style="margin:4px 0 0 0; font-size:0.75rem; color:var(--text-sub);">${game.playCount || 0} plays</p>
            </div>
        </a>
    `;
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
        const allGames = await fetchGames();
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

        listEl.innerHTML = related.map(renderMiniCard).join("");
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
        console.error("[PlayPage] No game ID provided");
        window.location.href = "/games/";
        return;
    }

    // 1. Iframe & Loader elements (Crucial)
    const frame = document.getElementById("game-frame");
    const loader = document.getElementById("loading-indicator");

    try {
        const game = await getGameById(gameId);
        if (!game) {
            alert("게임을 찾을 수 없습니다.");
            window.location.href = "/games/";
            return;
        }

        // 2. Load Game First! (To avoid black screen if UI updates fail)
        if (frame) {
            frame.src = game.url;
            frame.onload = () => {
                if (loader) loader.style.display = "none";
            };
        }

        // 3. Update UI Safely
        document.title = `${game.title} | Tracking SA`;
        
        const titleEl = document.getElementById("display-title");
        const authorEl = document.getElementById("display-author");
        const playsEl = document.getElementById("display-plays");
        const shareBtn = document.getElementById("share-btn");

        if (titleEl) titleEl.textContent = game.title;
        if (authorEl) authorEl.textContent = `By ${game.authorName || 'Admin'}`;
        if (playsEl) playsEl.textContent = `${game.playCount || 0} plays`;
        
        if (shareBtn) {
            shareBtn.onclick = () => handleShare(game);
        }

        // 4. Load Extra Data
        loadRelatedGames(game.category, gameId);
        
        incrementPlayCount(gameId).catch(e => console.warn("[PlayPage] Play count tracking failed", e));

    } catch (err) {
        console.error("[PlayPage] Initialization failed:", err);
        // Fallback: if elements are missing, at least try to show the iframe if we have the ID
        if (frame && !frame.src) {
            // Hardcoded fallback for default games if everything else fails
            if (gameId === 'tetris') frame.src = '/games/tetris/';
            if (gameId === 'ai-evolution') frame.src = '/games/ai-evolution/';
        }
    }
}

// Start immediately and also on DOMContentLoaded just in case
initPlayPage();
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayPage);
}
