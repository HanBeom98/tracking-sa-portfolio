/**
 * Game Application Service
 */
import { gameRepository } from '../infra/gameRepository.js';
import { Game } from '../domain/Game.js';

export const gameService = {
    async getApprovedGames() {
        const defaultGames = [
            new Game({
                id: 'tetris',
                title: '테트리스',
                description: '가볍게 즐기는 클래식 퍼즐 게임',
                url: '/games/tetris/',
                authorName: 'Admin',
                status: 'approved',
                category: 'classic',
                createdAt: '2026-01-01T00:00:00.000Z'
            }),
            new Game({
                id: 'ai-evolution',
                title: 'AI 진화 2048',
                description: '인공지능 진화 퍼즐 게임',
                url: '/games/ai-evolution/',
                authorName: 'Admin',
                status: 'approved',
                category: 'puzzle',
                createdAt: '2026-01-01T01:00:00.000Z'
            })
        ];

        try {
            const userGames = await gameRepository.fetchApprovedGames();
            
            // Map default games for easier merging
            const mergedMap = new Map();
            defaultGames.forEach(dg => mergedMap.set(dg.id, dg));
            
            // Override/Merge with DB data (Play counts, updated info)
            userGames.forEach(ug => {
                mergedMap.set(ug.id, ug);
            });

            return Array.from(mergedMap.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.warn('[GameService] Falling back to default games:', error);
            return defaultGames;
        }
    },

    async getGame(id) {
        const all = await this.getApprovedGames();
        const game = all.find(g => g.id === id);
        if (game) return game;
        
        return await gameRepository.getById(id);
    },

    async submitNewGame(payload) {
        if (typeof window === "undefined" || !window.AuthGateway) throw new Error('auth_required');
        
        const user = window.AuthGateway.getCurrentUser();
        if (!user) throw new Error('auth_required');

        return await gameRepository.create({
            ...payload,
            authorUid: user.uid,
            authorName: user.displayName || user.email || 'Anonymous'
        });
    },

    async getMySubmissions() {
        if (typeof window === "undefined" || !window.AuthGateway) return [];
        const user = window.AuthGateway.getCurrentUser();
        if (!user) return [];

        return await gameRepository.fetchGamesByAuthor(user.uid);
    },

    async getPendingGames() {
        return await gameRepository.fetchPendingGames();
    },

    async approveGame(id) {
        return await gameRepository.updateStatus(id, 'approved');
    },

    async rejectAndRemoveGame(id) {
        return await gameRepository.delete(id);
    },

    async deleteGame(id) {
        return await gameRepository.delete(id);
    },

    async updateCategory(id, category) {
        return await gameRepository.updateCategory(id, category);
    },

    /**
     * Track game play and handle initial setup for default games if missing.
     */
    async trackPlay(id) {
        try {
            await gameRepository.incrementPlayCount(id);
        } catch (err) {
            // Self-healing for missing default game documents
            if (id === 'tetris' || id === 'ai-evolution') {
                await this._initializeDefaultGame(id);
            }
        }
    },

    /**
     * Private helper to initialize default games in Firestore when an admin visits.
     * @private
     */
    async _initializeDefaultGame(id) {
        if (typeof window === "undefined" || !window.AuthGateway) return;

        // Ensure Auth is ready
        await window.AuthGateway.waitForReady();
        const profile = window.AuthGateway.getCurrentUserProfile();
        const user = window.AuthGateway.getCurrentUser();

        // Critical Check: Only proceed if admin AND user UID exists
        if (profile?.role === "admin" && user?.uid) {
            console.info(`[GameService] Self-healing: Initializing ${id} in Firestore...`);
            const all = await this.getApprovedGames();
            const g = all.find(x => x.id === id);
            
            if (g) {
                try {
                    await gameRepository.set(id, {
                        id: g.id,
                        title: g.title,
                        description: g.description,
                        url: g.url,
                        authorName: g.authorName || 'Admin',
                        authorUid: user.uid,
                        playCount: 1,
                        status: 'approved',
                        category: g.category || 'classic',
                        createdAt: g.createdAt || new Date().toISOString()
                    });
                    console.info(`[GameService] ${id} initialized successfully.`);
                } catch (e) {
                    console.error(`[GameService] Failed to initialize ${id}:`, e);
                }
            }
        }
    }
};
