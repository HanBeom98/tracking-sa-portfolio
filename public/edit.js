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
 * ID로 특정 게시물을 업데이트합니다.
 */
async function updatePost(id, postData) {
    await postsCollection.doc(id).update(postData);
}

// URL에서 게시물 ID 가져오기
const postId = new URLSearchParams(window.location.search).get('id');

// 폼 렌더링 함수
function renderForm(post) {
    const editForm = document.getElementById('edit-form');
    if (!editForm) return;

    if (!post) {
        editForm.innerHTML = '<h1>수정할 게시물을 찾을 수 없습니다.</h1>';
        return;
    }
    
    editForm.innerHTML = `
        <div class="form-field full-width">
            <label for="title">제목</label>
            <input type="text" id="title" value="${post.title}" required>
        </div>
        <div class="form-field full-width">
            <label for="content">내용</label>
            <textarea id="content" rows="15" required>${post.content}</textarea>
        </div>
        <div class="form-field">
            <label for="password">비밀번호</label>
            <input type="password" id="password" placeholder="수정하려면 원본 비밀번호를 입력하세요" required>
        </div>
        <button type="submit" id="submit-button" class="go-test-button">수정 완료</button>
        <a href="post.html?id=${postId}" class="go-test-button cancel">취소</a>
    `;

    // 폼 제출 이벤트 리스너
    editForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const title = document.getElementById('title').value;
        const content = document.getElementById('content').value;
        const password = document.getElementById('password').value;
        const submitButton = document.getElementById('submit-button');

        if (!title || !content || !password) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        
        // 비밀번호 확인
        const passwordHash = CryptoJS.SHA256(password).toString();
        if (passwordHash !== post.passwordHash) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.textContent = '수정 중...';

        try {
            await updatePost(postId, { title, content });
            alert('게시물이 성공적으로 수정되었습니다.');
            window.location.href = `post.html?id=${postId}`;
        } catch (e) {
            console.error('게시물 수정 실패:', e);
            alert('게시물 수정에 실패했습니다. 잠시 후 다시 시도해주세요.');
            submitButton.disabled = false;
            submitButton.textContent = '수정 완료';
        }
    });
}


// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
    if (!postId) {
        const editForm = document.getElementById('edit-form');
        editForm.innerHTML = '<h1>잘못된 접근입니다.</h1>';
        return;
    }

    try {
        const post = await getPost(postId);
        renderForm(post);
    } catch (e) {
        console.error('게시물 정보 로딩 실패:', e);
        const editForm = document.getElementById('edit-form');
        if(editForm) {
            editForm.innerHTML = '<h1>게시물 정보를 불러오는 데 실패했습니다.</h1>';
        }
    }
});
