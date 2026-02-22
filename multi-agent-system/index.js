// index.js
const orchestrator = require('./orchestrator');

async function main() {
  const userRequest = "기존 운세 서비스와 시너지를 낼 수 있는 '오늘의 행운의 컬러 & 아이템 추천' 페이지를 만들어줘. GEMINI.md 가이드라인에 따라 **Web Components**를 사용하여 캡슐화된 컴포넌트로 구현하고, 순수 HTML, CSS, JavaScript(Vanilla JS)만 사용해줘. 결과물은 프로젝트 루트의 'lucky-recommendation' 폴더에 index.html, style.css, script.js로 저장될 수 있도록 코드를 짜줘. 디자인은 현대적이고 세련된 스타일(oklch 컬러, deep shadow 등 적용)로 부탁해."

  await orchestrator(userRequest);
}

main();