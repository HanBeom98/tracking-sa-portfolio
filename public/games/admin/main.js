import { fetchPendingGames, fetchGames, updateGameStatus, deleteGame, updateGameCategory } from "../application/game-hub-service.js";

async function checkAdmin() {
    if (typeof window === "undefined" || !window.AuthGateway) return false;

    await window.AuthGateway.waitForReady();
    const profile = window.AuthGateway.getCurrentUserProfile();
    if (!profile || profile.role !== "admin") {
        alert("관리자 권한이 필요합니다.");
        window.location.href = "/games/";
        return false;
    }
    return true;
}

function renderGameCard(game, isPending = false) {
    const card = document.createElement("div");
    card.className = "game-card";
    card.id = `game-${game.id}`;
    
    const categories = ['puzzle', 'action', 'ai', 'classic', 'etc'];
    const catOptions = categories.map(c => 
        `<option value="${c}" ${game.category === c ? 'selected' : ''}>${c.toUpperCase()}</option>`
    ).join("");

    card.innerHTML = `
        <div class="game-thumb">
            <img src="${game.thumbnail || '/favicon.svg'}" alt="thumb">
        </div>
        <div class="game-info">
            <h3>${game.title}</h3>
            <p>${game.description}</p>
            <div class="game-meta">
                Author: ${game.authorName} | ID: ${game.id}
            </div>
        </div>
        <div class="admin-actions">
            ${isPending ? `
                <button class="btn btn-approve" data-id="${game.id}">Approve</button>
                <button class="btn btn-reject" data-id="${game.id}">Reject</button>
            ` : `
                <select class="cat-select" data-id="${game.id}">
                    ${catOptions}
                </select>
                <button class="btn btn-delete" data-id="${game.id}">Delete</button>
            `}
        </div>
    `;

    return card;
}

async function handlePendingAction(e) {
    const btn = e.target.closest(".btn");
    if (!btn) return;

    const gameId = btn.dataset.id;
    const isApprove = btn.classList.contains("btn-approve");
    
    try {
        btn.disabled = true;
        if (isApprove) {
            await updateGameStatus(gameId, "approved");
            alert("게임이 승인되었습니다.");
        } else {
            if (confirm("정말로 이 제출물을 거절하시겠습니까? (삭제됨)")) {
                await deleteGame(gameId);
                alert("제출물이 삭제되었습니다.");
            } else {
                btn.disabled = false;
                return;
            }
        }
        window.location.reload(); // Refresh to update both lists
    } catch (err) {
        console.error("[AdminAction] Failed:", err);
        alert("오류가 발생했습니다.");
        btn.disabled = false;
    }
}

async function handleInventoryAction(e) {
    const target = e.target;
    const gameId = target.dataset.id;

    if (target.classList.contains("btn-delete")) {
        if (confirm("정말로 이 게임을 영구 삭제하시겠습니까?")) {
            try {
                await deleteGame(gameId);
                document.getElementById(`game-${gameId}`)?.remove();
                alert("삭제 완료.");
            } catch (err) {
                alert("삭제 실패.");
            }
        }
    } else if (target.classList.contains("cat-select")) {
        target.onchange = async () => {
            const newCat = target.value;
            try {
                await updateGameCategory(gameId, newCat);
                alert(`카테고리가 ${newCat}으로 변경되었습니다.`);
            } catch (err) {
                alert("카테고리 변경 실패.");
            }
        };
    }
}

async function initAdminPage() {
    if (!(await checkAdmin())) return;

    const pendingContainer = document.getElementById("pending-list-container");
    const approvedContainer = document.getElementById("approved-list-container");

    try {
        // 1. Fetch Pending
        const pendingGames = await fetchPendingGames();
        if (pendingGames.length === 0) {
            pendingContainer.innerHTML = '<div class="empty-state">No pending games.</div>';
        } else {
            pendingContainer.innerHTML = "";
            pendingGames.forEach(g => pendingContainer.appendChild(renderGameCard(g, true)));
            pendingContainer.onclick = handlePendingAction;
        }

        // 2. Fetch Approved (Inventory)
        const allGames = await fetchGames();
        // Filter out default games (tetris, ai-evolution) as they are static
        const userGames = allGames.filter(g => g.id !== 'tetris' && g.id !== 'ai-evolution');
        
        if (userGames.length === 0) {
            approvedContainer.innerHTML = '<div class="empty-state">No user-submitted games in inventory.</div>';
        } else {
            approvedContainer.innerHTML = "";
            userGames.forEach(g => approvedContainer.appendChild(renderGameCard(g, false)));
            approvedContainer.onclick = handleInventoryAction;
        }

    } catch (err) {
        console.error("[AdminInit] Failed:", err);
    }
}

initAdminPage();
