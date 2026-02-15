// Firestore 서비스 함수
const postsCollection = db.collection('posts');

/**
 * 새 게시물을 추가합니다.
 * @param {Object} postData 
 * @returns {Promise<void>}
 */
async function addPost(postData) {
  await postsCollection.add({
    ...postData,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// 닉네임 랜덤 생성 함수
function generateRandomNickname() {
    const adjectives = ["친절한", "용감한", "슬기로운", "재빠른", "고요한", "명랑한"];
    const nouns = ["호랑이", "사자", "토끼", "거북이", "다람쥐", "고양이"];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);
    return `${adjective} ${noun} ${number}`;
}


// 폼 제출 처리
document.getElementById('write-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    const submitButton = document.getElementById('submit-button');

    if (password !== passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    
    if (!title || !content || !password) {
        alert('모든 필드를 입력해주세요.');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = '등록 중...';

    try {
        // 비밀번호 해싱 (SHA256)
        const passwordHash = CryptoJS.SHA256(password).toString();

        // 임의 닉네임 생성
        const nickname = generateRandomNickname();

        // Firestore에 저장할 데이터
        const postData = {
            title,
            content,
            nickname,
            passwordHash, // 해싱된 비밀번호 저장
        };

        await addPost(postData);
        
        alert('게시물이 성공적으로 등록되었습니다.');
        window.location.href = 'board.html';

    } catch (e) {
        console.error('게시물 등록 실패:', e);
        alert('게시물 등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
        submitButton.disabled = false;
        submitButton.textContent = '등록하기';
    }
});
