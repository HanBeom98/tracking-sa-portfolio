/**
 * Game UI Renderer
 */
export const gameRenderer = {
    renderGameCard(game, options = {}) {
        const { showStatus = false, onDelete = null } = options;
        
        const isOfficial = game.isAdminOfficial();
        const badgeClass = isOfficial ? 'badge-official' : 'badge-community';
        const badgeText = isOfficial ? 'Official' : 'Community';
        
        const statusHtml = showStatus ? 
            `<span class="status-chip status-${game.status}">${game.status.toUpperCase()}</span>` : 
            '';

        const deleteBtn = (showStatus && onDelete) ? 
            `<button class="delete-game-btn" data-id="${game.id}" style="background:none; border:none; color:oklch(60% 0.15 20); cursor:pointer; font-size:0.75rem; font-weight:800; padding:0;">[DELETE]</button>` : '';

        return `
            <article class="game-card" id="game-card-${game.id}">
                <div class="game-badge ${badgeClass}">${badgeText}</div>
                <div class="game-thumb">
                    <img src="${game.thumbnail}" alt="${game.title}" onerror="this.src='/favicon.svg'">
                </div>
                <div class="game-info">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <h3 class="game-card-title">${game.title}</h3>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                            ${statusHtml}
                            ${deleteBtn}
                        </div>
                    </div>
                    <p class="game-card-desc">${game.description}</p>
                    <div class="game-meta">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span>By ${game.authorName}</span>
                            <span style="font-size: 0.75rem; color: var(--p-blue); font-weight: 700;">${game.playCount} plays</span>
                        </div>
                        <a href="${game.getPlayUrl()}" class="play-btn" data-i18n="play_now">PLAY</a>
                    </div>
                </div>
            </article>
        `;
    },

    renderMiniCard(game) {
        return `
            <a href="${game.getPlayUrl()}" style="text-decoration:none; display:flex; flex-direction:column; background:white; border-radius:12px; overflow:hidden; border:1px solid oklch(92% 0.02 260); transition:transform 0.2s;">
                <div style="width:100%; aspect-ratio:16/9; background:oklch(96% 0.01 250); display:flex; justify-content:center; align-items:center;">
                    <img src="${game.thumbnail}" style="width:30px; opacity:0.5;" onerror="this.src='/favicon.svg'">
                </div>
                <div style="padding:12px;">
                    <h4 style="margin:0; font-size:0.9rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${game.title}</h4>
                    <p style="margin:4px 0 0 0; font-size:0.75rem; color:var(--text-sub);">${game.playCount} plays</p>
                </div>
            </a>
        `;
    },

    renderAdminCard(game, isPending = false) {
        const categories = ['puzzle', 'action', 'ai', 'classic', 'etc'];
        const catOptions = categories.map(c => 
            `<option value="${c}" ${game.category === c ? 'selected' : ''}>${c.toUpperCase()}</option>`
        ).join("");

        return `
            <div class="game-card" id="game-${game.id}">
                <div class="game-thumb">
                    <img src="${game.thumbnail}" alt="thumb" style="width:30px; opacity:0.5;">
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
            </div>
        `;
    },

    renderSkeleton() {
        return `
            <article class="game-card loading-shimmer" style="border-color:var(--bg-sub);">
                <div class="game-thumb" style="background:var(--bg-sub); height:160px;"></div>
                <div class="game-info" style="padding:20px;">
                    <div style="height:20px; width:60%; background:var(--bg-sub); border-radius:4px; margin-bottom:10px;"></div>
                    <div style="height:14px; width:90%; background:var(--bg-sub); border-radius:4px; margin-bottom:5px;"></div>
                    <div style="height:14px; width:40%; background:var(--bg-sub); border-radius:4px;"></div>
                </div>
            </article>
        `.repeat(6);
    }
};
