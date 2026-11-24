// Read metadata from a bounded prefix, never walk the large round/state payload.
// This is not a full-document validator: incomplete/unusual layouts go to the web.
export const MAX_REPLAY_HEADER_BYTES = 16 * 1024;
const incomplete = Symbol('incomplete JSON prefix');
const invalid = () => { throw new Error('INVALID_JSON'); };
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const validId = value => /^[a-zA-Z0-9_-]{1,32}$/.test(value);
const number = value => (typeof value === 'number' || typeof value === 'string' && value.trim())
  && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const label = (value, fallback = '') => typeof value === 'string' ? value.slice(0, 200) : fallback;

export function parseReplayHeader(text) {
  if (typeof text !== 'string') invalid();
  if (text.length > MAX_REPLAY_HEADER_BYTES) throw new Error('HEADER_TOO_LARGE');
  let at = text.charCodeAt(0) === 0xfeff ? 1 : 0, members = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[at] || '\0')) at++; };
  const expect = char => {
    whitespace(); if (at === text.length) throw incomplete;
    if (text[at++] !== char) invalid();
  };
  function stringEnd() {
    if (text[at++] !== '"') invalid();
    while (at < text.length) {
      const char = text[at++];
      if (char === '"') return;
      if (char === '\\') at++;
    }
    throw incomplete;
  }
  function value() {
    whitespace(); if (at >= text.length) throw incomplete;
    const start = at, first = text[at];
    if (first === '"') stringEnd();
    else if (first === '{' || first === '[') {
      const stack = [];
      while (at < text.length) {
        const char = text[at];
        if (char === '"') { stringEnd(); continue; }
        at++;
        if (char === '{' || char === '[') {
          stack.push(char); if (stack.length > 32) throw new Error('UNSUPPORTED_REPLAY');
        } else if (char === '}' || char === ']') {
          if (stack.pop() !== (char === '}' ? '{' : '[')) invalid();
          if (!stack.length) break;
        }
      }
      if (stack.length) throw incomplete;
    } else {
      while (at < text.length && !/[,}\]\x20\t\r\n]/.test(text[at])) at++;
      if (at === text.length) throw incomplete;
    }
    try { return JSON.parse(text.slice(start, at)); } catch { invalid(); }
  }
  function object(visit) {
    expect('{'); whitespace(); if (text[at] === '}') { at++; return null; }
    while (true) {
      if (++members > 64) throw new Error('UNSUPPORTED_REPLAY');
      whitespace(); if (at >= text.length) throw incomplete;
      if (text[at] !== '"') invalid();
      const name = value(); expect(':');
      const result = visit(name);
      if (result) return result;
      whitespace(); if (at >= text.length) throw incomplete;
      if (text[at] === '}') { at++; return null; }
      expect(',');
    }
  }
  try {
    return object(name => {
      if (name !== 'replay_info') { value(); return null; }
      let summary, roster;
      return object(key => {
        const entry = value();
        if (key === 'replayMatchSummaryInfo') {
          if (summary !== undefined || !record(entry)) throw new Error('UNSUPPORTED_REPLAY');
          summary = entry;
        } else if (key === 'replayCharacterSummaryInfo') {
          if (roster !== undefined || !Array.isArray(entry)) throw new Error('UNSUPPORTED_REPLAY');
          roster = entry;
        }
        if (!summary || !roster) return null;
        if (!roster.length || roster.length > 25) throw new Error('UNSUPPORTED_REPLAY');
        const players = roster.map(player => {
          if (!record(player) || player.nexonSN == null) throw new Error('UNSUPPORTED_REPLAY');
          const id = String(player.nexonSN);
          if (!validId(id)) throw new Error('UNSUPPORTED_REPLAY');
          return {nexonSN: id, nickName: label(player.nickName, '이름 없음'), teamNo: number(player.teamNo),
            kill: number(player.kill), death: number(player.death), assist: number(player.assist), damage: number(player.damage)};
        });
        if (new Set(players.map(player => player.nexonSN)).size !== players.length) throw new Error('UNSUPPORTED_REPLAY');
        return {summary: {mapName: label(summary.mapName, '알 수 없는 맵'), date: label(summary.matchDate),
          teamAWinCnt: number(summary.teamAWinCnt), teamBWinCnt: number(summary.teamBWinCnt), winTeam: number(summary.winTeam)}, players};
      });
    });
  } catch (error) { if (error === incomplete) return null; throw error; }
}
