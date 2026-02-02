// 페이지가 로드되었을 때 공통 레이아웃을 삽입하는 함수
async function loadLayout() {
    // 1. 헤더 파일을 가져옵니다.
    const headerResponse = await fetch('layout/header.html');
    if (headerResponse.ok) {
        const headerHtml = await headerResponse.text();
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = headerHtml;
        }
    }

    // 2. 헤더가 삽입된 후, 테마 변경 버튼에 이벤트 리스너를 추가합니다.
    const themeToggle = document.getElementById('color-change');
    const body = document.body;

    if (themeToggle && body) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('light-mode');
        });
    }
}

// DOM이 로드되면 레이아웃을 불러옵니다.
document.addEventListener('DOMContentLoaded', loadLayout);
