export const SITE = 'https://trackingsa.com';
export const GUIDE = `${SITE}/guides/replay-analysis-guide/`;
export const LAB = `${SITE}/stats/sudden-attack/replay/`;

// Data from nicknames/files is display text, never Discord formatting or mentions.
export function displayText(value, max = 150) {
  return String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/@/g, '＠').replace(/[\\`*_~|<>\[\]()#]/g, '\\$&').slice(0, max) || '정보 없음';
}

export function message(data) {
  return { content: '', embeds: [], components: [], ...data, allowed_mentions: { parse: [] } };
}

export function link(label, url) { return { type: 2, style: 5, label, url }; }
export function row(...components) { return { type: 1, components }; }
export function helpMessage(retired = false) {
  return message({ embeds: [{ title: 'TrackingSA · 전적과 리플레이', color: 0x40c5df,
    description: `${retired ? '기존 내전 명령은 종료됐어요. 아래 새 명령을 이용해 주세요.\n\n' : ''}`
      + '**/전적 닉네임**\n티어와 최근 전적을 조회합니다.\n\n'
      + '**/리플레이 파일**\n공식 병영수첩에서 받은 JSON 하나를 첨부하고 분석할 선수를 선택하세요.\n'
      + '봇은 파일 앞부분에서 맵·스코어·선수 기록만 읽습니다. 핵심 장면·라운드 기록·그래프는 상세 분석 링크에서 확인하세요. AI 이용권은 사용하지 않습니다.\n\n'
      + '**공개 범위**\n리플레이 결과와 원본 JSON 링크는 기본으로 채널에 공개됩니다. 나만 보려면 `공개:거짓`을 선택하세요. 선수 선택은 요청자만 조작할 수 있으며, 변경한 결과는 함께 보는 사람에게도 반영됩니다.\n'
      + '파일은 Discord에 업로드되고 서버에서 읽습니다. 원본과 분석 결과를 별도 DB에 저장하지 않습니다.\n\n'
      + '선수 선택은 15분 동안 가능합니다. 사이트에서 이어 보려면 같은 JSON을 다시 선택하세요. 상세 분석은 기기 안에서 처리합니다.',
  }], components: [row(link('JSON 받는 방법', GUIDE), link('사이트 분석실', LAB))] });
}
