import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_REPLAY_HEADER_BYTES, parseReplayHeader} from '../../functions/discord/replay-header.js';
import {contextFixture} from '../fixtures/replay-context.js';

test('bounded header reads file summaries without parsing round/state data', () => {
  const replay = contextFixture().replay_info;
  replay.replayCharacterSummaryInfo[0].damage = 1234;
  const prefix = JSON.stringify({replay_info: {
    replayMatchSummaryInfo: replay.replayMatchSummaryInfo,
    replayCharacterSummaryInfo: replay.replayCharacterSummaryInfo
  }}).slice(0,-2);
  const header = parseReplayHeader(prefix + ',"replayRoundInfo":[THIS TAIL IS NOT PARSED');
  assert.equal(header.players.length, 6);
  assert.equal(header.players[0].damage, 1234);
  assert.equal(header.players[1].damage, null);
  assert.equal(header.summary.mapName, 'test map');
  assert.equal('replayRoundInfo' in header, false);
});

test('header keys are structural, support escapes/order/BOM, and ignore nested lookalikes', () => {
  const replay = contextFixture().replay_info;
  const expected = parseReplayHeader(JSON.stringify({replay_info: replay}));
  const reordered = {description: '"replay_info":{\\} [ \\ "', nested: {replay_info: {bad: true}}, replay_info: {
    note: {replayMatchSummaryInfo: {mapName: 'wrong'}, array: ['}',']','"']},
    replayCharacterSummaryInfo: replay.replayCharacterSummaryInfo,
    replayMatchSummaryInfo: replay.replayMatchSummaryInfo,
  }};
  assert.deepEqual(parseReplayHeader('\ufeff \n' + JSON.stringify(reordered)), expected);
});

test('missing or incomplete prefix falls back without pretending to validate the full file', () => {
  assert.equal(parseReplayHeader(''), null);
  assert.equal(parseReplayHeader('{"replay_info":{"replayRoundInfo":[' + ' '.repeat(1000)), null);
  assert.equal(parseReplayHeader('{"replay_info":{"replayMatchSummaryInfo":{"mapName":"unfinished'), null);
  assert.equal(parseReplayHeader('{"other":{"replay_info":{}}}'), null);
  assert.throws(() => parseReplayHeader(' '.repeat(MAX_REPLAY_HEADER_BYTES + 1)), /HEADER_TOO_LARGE/);
});

test('malformed prefixes and invalid metadata are rejected before exposing selectable IDs', () => {
  for (const text of ['not JSON', '{unquoted:1}', '{"replay_info":{"bad":[}}', '{"replay_info":{"bad":"\\q"}}']) {
    assert.throws(() => parseReplayHeader(text), /INVALID_JSON/);
  }
  for (const change of [
    replay => { replay.replayCharacterSummaryInfo = []; },
    replay => { replay.replayCharacterSummaryInfo = Array(26).fill(replay.replayCharacterSummaryInfo[0]); },
    replay => { replay.replayCharacterSummaryInfo[0].nexonSN = '@everyone'; },
    replay => { replay.replayCharacterSummaryInfo[0].nexonSN = 'mate'; },
    replay => { replay.replayCharacterSummaryInfo[0] = null; },
    replay => { replay.replayMatchSummaryInfo = []; },
  ]) {
    const replay = contextFixture().replay_info; change(replay);
    assert.throws(() => parseReplayHeader(JSON.stringify({replay_info: replay})), /UNSUPPORTED_REPLAY/);
  }
});

test('missing and non-numeric statistics remain unknown, including team zero versus missing team', () => {
  const parsed = contextFixture();
  const player = parsed.replay_info.replayCharacterSummaryInfo[0];
  Object.assign(player, {damage: null, assist: '', kill: 'bogus', death: -1, teamNo: null});
  const header = parseReplayHeader(JSON.stringify(parsed));
  assert.deepEqual([header.players[0].damage, header.players[0].assist, header.players[0].kill,
    header.players[0].death, header.players[0].teamNo], [null,null,null,null,null]);
  assert.equal(header.players[1].teamNo, 0);
});
