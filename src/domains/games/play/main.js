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
            document.getElementById("related-section").style.display = "none";
            return;
        }

        listEl.innerHTML = related.map(renderMiniCard).join("");
    } catch (e) {
        console.warn("[RelatedGames] Failed to load:", e);
        document.getElementById("related-section").style.display = "none";
    }
}

async function initPlayPage() {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get("id");

    if (!gameId) {
        alert("게임 ID가 올바르지 않습니다.");
        window.location.href = "/games/";
        return;
    }

    const game = await getGameById(gameId);
    if (!game) {
        alert("게임을 찾을 수 없습니다.");
        window.location.href = "/games/";
        return;
    }

    // Update UI & Metadata
    document.title = `${game.title} | Tracking SA`;
    document.getElementById("display-title").textContent = game.title;
    document.getElementById("display-author").textContent = `By ${game.authorName || 'Admin'}`;
    document.getElementById("display-plays").textContent = `${game.playCount || 0} plays`;

    // Bind Share Action
    const shareBtn = document.getElementById("share-btn");
    if (shareBtn) {
        shareBtn.onclick = () => handleShare(game);
    }

    const frame = document.getElementById("game-frame");
    const loader = document.getElementById("loading-indicator");

    frame.src = game.url;
    frame.onload = () => {
        loader.style.display = "none";
    };

    loadRelatedGames(game.category, gameId);

    try {
        await incrementPlayCount(gameId);
    } catch (e) {
        console.warn("[PlayPage] Play count tracking failed", e);
    }
}

document.addEventListener("DOMContentLoaded", initPlayPage);
