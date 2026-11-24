// One manifest for registration, routing, and help. Registration is a separate step.
export const discordCommands = [
  { name: '전적', description: '서든어택 닉네임으로 티어와 최근 전적을 확인합니다.', type: 1,
    integration_types: [0], contexts: [0],
    options: [{ name: '닉네임', description: '검색할 서든어택 닉네임', type: 3, required: true, min_length: 2, max_length: 30 }] },
  { name: '리플레이', description: '리플레이의 경기·선수 요약을 보고 상세 웹 분석으로 이어갑니다.', type: 1,
    integration_types: [0], contexts: [0],
    options: [
      { name: '파일', description: '공식 병영수첩에서 받은 JSON 파일 하나 (최대 2MB)', type: 11, required: true },
      { name: '공개', description: '기본은 결과와 원본 JSON 링크를 채널에 공개합니다. 거짓을 선택하면 나만 봅니다.', type: 5 },
    ] },
  { name: '도움말', description: '전적 조회와 리플레이 분석 사용법을 확인합니다.', type: 1,
    integration_types: [0], contexts: [0] },
];

export const discordCommandNames = new Set(discordCommands.map(command => command.name));
