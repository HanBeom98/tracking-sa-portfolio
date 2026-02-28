/**
 * Game Domain Model
 */
export class Game {
    constructor({
        id,
        title,
        description,
        url,
        thumbnail,
        authorUid,
        authorName,
        status = 'pending',
        category = 'etc',
        playCount = 0,
        createdAt = new Date().toISOString(),
        updatedAt = null
    }) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.url = url;
        this.thumbnail = thumbnail || '/favicon.svg';
        this.authorUid = authorUid;
        this.authorName = authorName || 'Anonymous';
        this.status = status; // 'pending', 'approved', 'rejected'
        this.category = category; // 'puzzle', 'action', 'ai', 'classic', 'etc'
        this.playCount = playCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    static fromFirestore(doc) {
        const data = doc.data();
        return new Game({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
        });
    }

    isAdminOfficial() {
        return this.authorName === 'Admin';
    }

    getPlayUrl() {
        return `/games/play/?id=${this.id}`;
    }
}
