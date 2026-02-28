/**
 * Game Hub Application Service
 * Manages game listing and submissions via Firestore.
 */

async function getAuth() {
  if (typeof window !== "undefined" && window.AuthGateway) {
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

  try {
    const auth = await getAuth();
    if (!auth) return defaultGames;

    const db = auth.getAuthService()?.getFirestore?.() || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
    if (!db) return defaultGames;

    const snapshot = await db.collection('games')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const userGames = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Merge default games with user games, avoid duplicates by ID
    const merged = [...defaultGames];
    userGames.forEach(ug => {
      if (!merged.find(mg => mg.id === ug.id)) {
        merged.push(ug);
      }
    });
    
    return merged;
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
    authorUid: user.uid,
    authorName: user.displayName || user.email || 'Anonymous',
    status: 'pending',
    createdAt: (typeof firebase !== 'undefined') ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
  };

  return await db.collection('games').add(submission);
}
