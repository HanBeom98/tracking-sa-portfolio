/**
 * Game Hub Application Service
 * Manages game listing and submissions via Firestore.
 */

async function getAuth() {
  if (typeof window !== "undefined" && window.getTranslation) {
    // Wait for AuthGateway if not ready
    if (window.AuthGateway && window.AuthGateway.waitForReady) {
      await window.AuthGateway.waitForReady();
    }
    return window.AuthGateway;
  }
  return null;
}

/**
 * Fetch approved games from Firestore.
 * Fallback to default games (Tetris, 2048) if Firestore is unavailable.
 */
export async function fetchGames() {
  const defaultGames = [
    {
      id: 'tetris',
      title: '테트리스',
      description: '가볍게 즐기는 클래식 퍼즐 게임',
      url: '/games/tetris/',
      thumbnail: '/favicon.svg',
      authorName: 'Admin',
      status: 'approved',
      category: 'classic',
      createdAt: new Date().toISOString()
    },
    {
      id: 'ai-evolution',
      title: 'AI 진화 2048',
      description: '인공지능 진화 퍼즐 게임',
      url: '/games/ai-evolution/',
      thumbnail: '/favicon.svg',
      authorName: 'Admin',
      status: 'approved',
      category: 'puzzle',
      createdAt: new Date().toISOString()
    }
  ];

  try {
    const auth = await getAuth();
    if (!auth) return defaultGames;

    const db = auth.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
    if (!db) return defaultGames;

    const snapshot = await db.collection('games')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const userGames = snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        category: data.category || 'etc',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt 
      };
    });
    
    // Merge default games with user games, avoid duplicates by ID
    const merged = [...defaultGames];
    userGames.forEach(ug => {
      if (!merged.find(mg => mg.id === ug.id)) {
        merged.push(ug);
      }
    });
    
    // Re-sort merged list by createdAt desc
    return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('[GameHub] Failed to fetch games:', error);
    return defaultGames;
  }
}

/**
 * Submit a new game for review.
 */
export async function submitGame(payload) {
  const auth = await getAuth();
  if (!auth) throw new Error('auth_required');

  const user = auth.getCurrentUser();
  if (!user) throw new Error('auth_required');

  const db = auth.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  if (!db) throw new Error('database_unavailable');

  const submission = {
    ...payload,
    category: payload.category || 'etc',
    authorUid: user.uid,
    authorName: user.displayName || user.email || 'Anonymous',
    status: 'pending',
    playCount: 0,
    createdAt: (typeof firebase !== 'undefined' && firebase.firestore.FieldValue) 
      ? firebase.firestore.FieldValue.serverTimestamp() 
      : new Date().toISOString()
  };

  return await db.collection('games').add(submission);
}

/**
 * Fetch games submitted by the current user.
 */
export async function fetchMySubmissions() {
  const auth = await getAuth();
  if (!auth) return [];

  const user = auth.getCurrentUser();
  if (!user) return [];

  const db = auth.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  if (!db) return [];

  const snapshot = await db.collection('games')
    .where('authorUid', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
  }));
}

/**
 * [ADMIN] Fetch games pending approval.
 */
export async function fetchPendingGames() {
  const auth = await getAuth();
  if (!auth) throw new Error('auth_required');

  const db = auth.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  if (!db) throw new Error('database_unavailable');

  const snapshot = await db.collection('games')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
  }));
}

/**
 * [ADMIN] Update game status (approved/rejected).
 */
export async function updateGameStatus(gameId, status) {
  const auth = await getAuth();
  if (!auth) throw new Error('auth_required');

  const db = auth.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  if (!db) throw new Error('database_unavailable');

  return await db.collection('games').doc(gameId).update({ 
    status,
    updatedAt: (typeof firebase !== 'undefined' && firebase.firestore.FieldValue) 
      ? firebase.firestore.FieldValue.serverTimestamp() 
      : new Date().toISOString()
  });
}

/**
 * [ADMIN/OWNER] Delete a game.
 */
export async function deleteGame(gameId) {
  const auth = await getAuth();
  if (!auth) throw new Error('auth_required');

  const db = auth.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  if (!db) throw new Error('database_unavailable');

  return await db.collection('games').doc(gameId).delete();
}

/**
 * [ADMIN/OWNER] Update game category.
 */
export async function updateGameCategory(gameId, category) {
  const auth = await getAuth();
  if (!auth) throw new Error('auth_required');

  const db = auth.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  if (!db) throw new Error('database_unavailable');

  return await db.collection('games').doc(gameId).update({ 
    category,
    updatedAt: (typeof firebase !== 'undefined' && firebase.firestore.FieldValue) 
      ? firebase.firestore.FieldValue.serverTimestamp() 
      : new Date().toISOString()
  });
}

/**
 * Fetch a single game by ID.
 */
export async function getGameById(gameId) {
  // Check default games first
  const defaultGames = [
    {
      id: 'tetris',
      title: '테트리스',
      description: '가볍게 즐기는 클래식 퍼즐 게임',
      url: '/games/tetris/',
      thumbnail: '/favicon.svg',
      authorName: 'Admin',
      status: 'approved'
    },
    {
      id: 'ai-evolution',
      title: 'AI 진화 2048',
      description: '인공지능 진화 퍼즐 게임',
      url: '/games/ai-evolution/',
      thumbnail: '/favicon.svg',
      authorName: 'Admin',
      status: 'approved'
    }
  ];

  const foundDefault = defaultGames.find(g => g.id === gameId);
  if (foundDefault) return foundDefault;

  const auth = await getAuth();
  const db = auth?.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  if (!db) return null;

  const doc = await db.collection('games').doc(gameId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * Increment play count for a game.
 */
export async function incrementPlayCount(gameId) {
  const auth = await getAuth();
  const db = auth?.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  if (!db) return;

  // Don't track default games for now or handle separately
  if (gameId === 'tetris' || gameId === 'ai-evolution') return;

  const docRef = db.collection('games').doc(gameId);
  return await docRef.update({
    playCount: (typeof firebase !== 'undefined' && firebase.firestore.FieldValue) 
      ? firebase.firestore.FieldValue.increment(1) 
      : 1
  }).catch(e => console.warn('[GameHub] PlayCount increment failed:', e));
}
