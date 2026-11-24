// Anonymized regression shape: a six-versus-six Old Town draw with team_id 0/1.
export function createDrawDetail() {
  return {
    match_id: 'local-oldtown-draw',
    match_type: '퀵매치 클랜전',
    match_mode: '폭파미션',
    date_match: '2026-11-06T14:37:25.258Z',
    match_map: '올드타운',
    match_detail: Array.from({length:12}, (_,index) => ({
      team_id: index<6 ? '1' : '0',
      match_result: '3',
      user_name: index===0 ? 'Subject' : `Player${index}`,
      kill: index===0 ? 16 : index+2,
      death: index===0 ? 13 : index+3,
      assist: index===0 ? 6 : 2,
      damage: index===0 ? 2470 : 1000,
      headshot: index===0 ? 1 : 0,
    })),
  };
}

export function createDrawListRow() {
  const detail=createDrawDetail(), player=detail.match_detail[0];
  return {
    match_id: detail.match_id, match_type: detail.match_type, match_mode: detail.match_mode,
    date_match: detail.date_match, match_result:'3',
    kill:player.kill, death:player.death, assist:player.assist,
  };
}
