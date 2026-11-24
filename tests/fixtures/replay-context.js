// Synthetic data only; no downloaded player names or account identifiers.
export const roster = { focus: 0, mate: 0, spare: 0, enemy1: 1, enemy2: 1, enemy3: 1 };
export function makeRound(events = [], options = {}) {
  const teams = options.teams || roster;
  const playTime = options.playTime || 20;
  const attacks = events.map(([timeStamp, attackerNexonSN, victimNexonSN]) => ({
    timeStamp, eventType: 0, attackerNexonSN, victimNexonSN,
    attackerTeamNo: teams[attackerNexonSN], victimTeamNo: teams[victimNexonSN],
    attackerNickName: attackerNexonSN, victimNickName: victimNexonSN, itemName: 'test weapon'
  }));
  return { no: options.no || 1, offenseTeam: options.offenseTeam ?? 0, winTeam: options.winTeam ?? 1,
    playTime, replayAttackInfo: attacks, replayEnterInfo: [], replayThrowWeaponEventInfo: [],
    replayRoundSummaryInfo: Object.entries(teams).map(([nexonSN, teamNo]) => ({nexonSN, nickName: nexonSN, teamNo,
      kill: attacks.filter(e => e.attackerNexonSN === nexonSN).length,
      death: attacks.filter(e => e.victimNexonSN === nexonSN).length, breakType: 0, reJoin: 0})),
    replayCharacterInfo: Object.keys(teams).map(nexonSN => {
      const death = attacks.find(e => e.victimNexonSN === nexonSN);
      return {nexonSN, replayCharacterStateInfo: [{timeStamp: 0, state: 1, posX: 0, posY: 0},
        {timeStamp: death?.timeStamp ?? playTime * 10, state: death ? 2 : 1, posX: 0, posY: 0}]};
    }) };
}
export function makeReplay(rounds, teams = roster) {
  return {replay_info: {replayMatchSummaryInfo: {matchID: 'synthetic-context-match', mapName: 'test map',
    matchDate: '2020-01-01 AM 10:00', teamAWinCnt: 0, teamBWinCnt: rounds.length, winTeam: 1},
    replayCharacterSummaryInfo: Object.entries(teams).map(([nexonSN, teamNo]) => ({nexonSN, nickName: nexonSN,
      teamNo, kill: rounds.reduce((n, r) => n + r.replayAttackInfo.filter(e => e.attackerNexonSN === nexonSN).length, 0),
      death: rounds.reduce((n, r) => n + r.replayAttackInfo.filter(e => e.victimNexonSN === nexonSN).length, 0)})),
    replayRoundInfo: rounds}};
}
export const contextFixture = () => makeReplay([
  makeRound([[10, 'enemy1', 'mate'], [16, 'focus', 'enemy1'], [30, 'enemy2', 'spare'], [45, 'enemy3', 'focus']]),
  makeRound([[20, 'enemy1', 'focus']], {no: 2})
]);
