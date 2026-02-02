// Firestore 서비스 함수 (원래는 모듈로 분리하는 것이 좋음)
const postsCollection = db.collection('posts');

/**
 * 모든 게시물을 시간 역순으로 가져옵니다.
 * @returns {Promise<Array>} 게시물 배열
 */
async function getPosts() {
  const snapshot = await postsCollection.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


// 게시물 목록 렌더링 함수
function renderPosts(posts) {
    const postListContainer = document.querySelector('.post-list-container');
    if (!postListContainer) return;

    if (posts.length === 0) {
        postListContainer.innerHTML = '<p>아직 게시물이 없습니다. 첫 번째 글을 작성해보세요!</p>';
        return;
    }

    // 테이블 형태로 목록을 생성합니다.
    let tableHtml = `
        <table class="post-table">
            <thead>
                <tr>
                    <th>닉네임</th>
                    <th>제목</th>
                    <th>작성일</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    posts.forEach(post => {
        const date = post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : '날짜 없음';
        tableHtml += `
            <tr onclick="window.location.href='post.html?id=${post.id}'">
                <td>${post.nickname || '익명'}</td>
                <td>${post.title}</td>
                <td>${date}</td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;
    
    postListContainer.innerHTML = tableHtml;
}


// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const posts = await getPosts();
        renderPosts(posts);
    } catch (e) {
        console.error('게시물 로딩 실패:', e);
        const postListContainer = document.querySelector('.post-list-container');
        if(postListContainer) {
            postListContainer.innerHTML = '<p>게시물을 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.</p>';
        }
    }
});
