import { fetchPendingGames, updateGameStatus, deleteGame } from "../application/game-hub-service.js";

async function checkAdmin() {
    if (typeof window === "undefined" || !window.AuthGateway) return false;

    await window.AuthGateway.waitForReady();
    const user = window.AuthGateway.getCurrentUser();
    
    if (!user) {
        window.location.href = "/games/";
        return false;
    }

    // Role check (assuming AuthGateway or Firestore provides role info)
    const profile = window.AuthGateway.getCurrentUserProfile();
    if (!profile || profile.role !== "admin") {
        alert("관리자 권한이 필요합니다.");
        window.location.href = "/games/";
        return false;
    }

    return true;
}

function renderPendingCard(game) {
    const card = document.createElement("div");
    card.className = "pending-card";
    card.id = `game-${game.id}`;
    
    card.innerHTML = `
        <div class="pending-thumb">
            <img src="${game.thumbnail || '/favicon.svg'}" alt="thumb">
        </div>
        <div class="pending-info">
            <h3>${game.title}</h3>
            <p>${game.description}</p>
            <div class="pending-meta">
                URL: <a href="${game.url}" target="_blank">${game.url}</a> | 
                Author: ${game.authorName}
            </div>
        </div>
        <div class="admin-actions">
            <button class="btn btn-approve" data-id="${game.id}">Approve</button>
            <button class="btn btn-reject" data-id="${game.id}">Reject</button>
        </div>
    `;

    return card;
}

async function handleAction(e) {
    const btn = e.target;
    if (!btn.classList.contains("btn")) return;

    const gameId = btn.dataset.id;
    const isApprove = btn.classList.contains("btn-approve");
    
    try {
        btn.disabled = true;
        if (isApprove) {
            await updateGameStatus(gameId, "approved");
            alert("게임이 성공적으로 승인되었습니다.");
        } else {
            if (confirm("정말로 이 제출물을 거절하시겠습니까? (삭제됨)")) {
                await deleteGame(gameId);
                alert("제출물이 삭제되었습니다.");
            } else {
                btn.disabled = false;
                return;
            }
        }
        
        // Remove from list
        document.getElementById(`game-${gameId}`)?.remove();
        
        // Check if empty
        const container = document.getElementById("pending-list-container");
        if (container && container.children.length === 0) {
            container.innerHTML = '<div class="empty-state">No pending games at the moment.</div>';
        }
    } catch (err) {
        console.error("[AdminAction] Failed:", err);
        alert("작업 처리 중 오류가 발생했습니다.");
        btn.disabled = false;
    }
}

async function initAdminPage() {
    const isAdmin = await checkAdmin();
    if (!isAdmin) return;

    const container = document.getElementById("pending-list-container");
    if (!container) return;

    try {
        const games = await fetchPendingGames();
        
        if (games.length === 0) {
            container.innerHTML = '<div class="empty-state">No pending games at the moment.</div>';
            return;
        }

        container.innerHTML = "";
        games.forEach(game => {
            container.appendChild(renderPendingCard(game));
        });

        container.addEventListener("click", handleAction);
    } catch (err) {
        console.error("[AdminInit] Failed:", err);
        container.innerHTML = '<div class="empty-state" style="color: var(--error-main);">Failed to load pending games.</div>';
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminPage);
} else {
    initAdminPage();
}
