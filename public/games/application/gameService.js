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
                category: 'classic'
            }),
            new Game({
                id: 'ai-evolution',
                title: 'AI 진화 2048',
                description: '인공지능 진화 퍼즐 게임',
                url: '/games/ai-evolution/',
                authorName: 'Admin',
                status: 'approved',
                category: 'puzzle'
            })
        ];

        try {
            const userGames = await gameRepository.fetchApprovedGames();
            
            // Merge defaults with user games
            const merged = [...defaultGames];
            userGames.forEach(ug => {
                if (!merged.find(mg => mg.id === ug.id)) {
                    merged.push(ug);
                }
            });

            return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.warn('[GameService] Falling back to default games:', error);
            return defaultGames;
        }
    },

    async getGame(id) {
        // Check defaults first
        if (id === 'tetris' || id === 'ai-evolution') {
            const all = await this.getApprovedGames();
            return all.find(g => g.id === id);
        }
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

    async trackPlay(id) {
        if (id === 'tetris' || id === 'ai-evolution') return;
        return await gameRepository.incrementPlayCount(id);
    }
};
