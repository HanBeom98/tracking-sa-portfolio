// index.js 파일 내부를 이렇게 바꾸세요
const orchestrator = require('./orchestrator');

async function main() {
  // ⭐️ 바로 이 부분을 한범님이 말씀하신 문구로 교체하는 겁니다!
  const userRequest = "기존 운세 서비스와 시너지를 낼 수 있는 '오늘의 행운의 컬러 & 아이템 추천' 페이지를 만들어줘. 리액트 같은 프레임워크 쓰지 말고 **순수 HTML, CSS, JavaScript(Vanilla JS)**만 사용해서 짜줘. 모든 파일은 output/ 폴더에 각각 index.html, style.css, script.js로 저장되게 해줘."

  await orchestrator(userRequest);
}

main();