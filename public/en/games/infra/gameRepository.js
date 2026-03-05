/**
 * Game Infrastructure Layer (Firestore Repository)
 */
import { Game } from '../domain/Game.js';

async function getFirestore() {
    if (typeof window !== "undefined" && window.AuthGateway) {
        await window.AuthGateway.waitForReady();
        return window.AuthGateway.getAuthService()?.getFirestore?.() || 
               (typeof firebase !== 'undefined' ? firebase.firestore() : null);
    }
    return null;
}

export const gameRepository = {
    async fetchApprovedGames(limit = 50) {
        const db = await getFirestore();
        if (!db) return [];

        const snapshot = await db.collection('games')
            .where('status', '==', 'approved')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => Game.fromFirestore(doc));
    },

    async fetchPendingGames() {
        const db = await getFirestore();
        if (!db) return [];

        const snapshot = await db.collection('games')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => Game.fromFirestore(doc));
    },

    async fetchGamesByAuthor(uid) {
        const db = await getFirestore();
        if (!db) return [];

        const snapshot = await db.collection('games')
            .where('authorUid', '==', uid)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => Game.fromFirestore(doc));
    },

    async getById(id) {
        const db = await getFirestore();
        if (!db) return null;

        const doc = await db.collection('games').doc(id).get();
        return doc.exists ? Game.fromFirestore(doc) : null;
    },

    async create(payload) {
        const db = await getFirestore();
        if (!db) throw new Error('database_unavailable');

        const createdAt = (typeof firebase !== 'undefined' && firebase.firestore.FieldValue) 
            ? firebase.firestore.FieldValue.serverTimestamp() 
            : new Date().toISOString();

        return await db.collection('games').add({
            ...payload,
            status: 'pending',
            playCount: 0,
            createdAt
        });
    },

    async updateStatus(id, status) {
        const db = await getFirestore();
        if (!db) throw new Error('database_unavailable');

        const updatedAt = (typeof firebase !== 'undefined' && firebase.firestore.FieldValue) 
            ? firebase.firestore.FieldValue.serverTimestamp() 
            : new Date().toISOString();

        return await db.collection('games').doc(id).update({ status, updatedAt });
    },

    async updateCategory(id, category) {
        const db = await getFirestore();
        if (!db) throw new Error('database_unavailable');

        const updatedAt = (typeof firebase !== 'undefined' && firebase.firestore.FieldValue) 
            ? firebase.firestore.FieldValue.serverTimestamp() 
            : new Date().toISOString();

        return await db.collection('games').doc(id).update({ category, updatedAt });
    },

    async delete(id) {
        const db = await getFirestore();
        if (!db) throw new Error('database_unavailable');
        return await db.collection('games').doc(id).delete();
    },

    async set(id, data) {
        const db = await getFirestore();
        if (!db) throw new Error('database_unavailable');
        
        const updatedAt = (typeof firebase !== 'undefined' && firebase.firestore.FieldValue) 
            ? firebase.firestore.FieldValue.serverTimestamp() 
            : new Date().toISOString();

        return await db.collection('games').doc(id).set({
            ...data,
            updatedAt
        }, { merge: true });
    },

    async incrementPlayCount(id) {
        const db = await getFirestore();
        if (!db) return;

        const docRef = db.collection('games').doc(id);
        
        try {
            await docRef.update({
                playCount: (typeof firebase !== 'undefined' && firebase.firestore.FieldValue) 
                    ? firebase.firestore.FieldValue.increment(1) 
                    : 1
            });
        } catch (err) {
            // Document might not exist; propagate to application service for handling
            throw err;
        }
    }
};
