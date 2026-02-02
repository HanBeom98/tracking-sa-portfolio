// 관리자용 마스터 비밀번호 (실제 운영에서는 절대 이렇게 사용하면 안 됩니다!)
const ADMIN_PASSWORD = "admin"; // 예시

// Firestore 서비스 함수
const postsCollection = db.collection('posts');

/**
 * ID로 특정 게시물을 가져옵니다.
 */
async function getPost(id) {
  const doc = await postsCollection.doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * ID로 특정 게시물을 삭제합니다.
 */
async function deletePost(id) {
    await postsCollection.doc(id).delete();
}

// URL에서 게시물 ID 가져오기
const postId = new URLSearchParams(window.location.search).get('id');

// 게시물 렌더링 함수
function renderPost(post) {
    const postSection = document.getElementById('post-section');
    if (!postSection) return;

    if (!post) {
        postSection.innerHTML = '<h1>게시물을 찾을 수 없습니다.</h1>';
        return;
    }
    
    const date = post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleString() : '날짜 없음';
    postSection.innerHTML = `
        <h1>${post.title}</h1>
        <div class="post-meta">
            <span>작성자: ${post.nickname}</span> | 
            <span>작성일: ${date}</span>
        </div>
        <hr>
        <div class="post-content">${post.content.replace(/\n/g, '<br>')}</div>
        <hr>
        <div class="post-actions">
            <button id="edit-button" class="go-test-button">수정</button>
            <button id="delete-button" class="go-test-button delete">삭제</button>
            <a href="board.html" class="go-test-button">목록으로</a>
        </div>
    `;
    
    // 삭제 버튼 이벤트 리스너
    document.getElementById('delete-button').addEventListener('click', async () => {
        const password = prompt('삭제하려면 비밀번호를 입력하세요. (관리자는 관리자 비밀번호 입력)');
        if (password === null) return; // 사용자가 취소한 경우

        // 1. 관리자 비밀번호 확인
        if (password === ADMIN_PASSWORD) {
            if (confirm('관리자 권한으로 게시물을 정말 삭제하시겠습니까?')) {
                await deletePost(postId);
                alert('게시물이 삭제되었습니다.');
                window.location.href = 'board.html';
            }
            return;
        }

        // 2. 사용자 비밀번호 확인
        const passwordHash = CryptoJS.SHA256(password).toString();
        if (passwordHash === post.passwordHash) {
            if (confirm('게시물을 정말 삭제하시겠습니까?')) {
                await deletePost(postId);
                alert('게시물이 삭제되었습니다.');
                window.location.href = 'board.html';
            }
        } else {
            alert('비밀번호가 일치하지 않습니다.');
        }
    });

    // 수정 버튼 이벤트 리스너
    document.getElementById('edit-button').addEventListener('click', () => {
        const password = prompt('수정하려면 비밀번호를 입력하세요.');
        if (password === null) return;

        const passwordHash = CryptoJS.SHA256(password).toString();
        if (passwordHash === post.passwordHash) {
            window.location.href = `edit.html?id=${postId}`;
        } else {
            alert('비밀번호가 일치하지 않습니다.');
        }
    });
}


// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
    if (!postId) {
        const postSection = document.getElementById('post-section');
        postSection.innerHTML = '<h1>잘못된 접근입니다.</h1>';
        return;
    }

    try {
        const post = await getPost(postId);
        renderPost(post);
    } catch (e) {
        console.error('게시물 로딩 실패:', e);
        const postSection = document.getElementById('post-section');
        if(postSection) {
            postSection.innerHTML = '<h1>게시물을 불러오는 데 실패했습니다.</h1>';
        }
    }
});
