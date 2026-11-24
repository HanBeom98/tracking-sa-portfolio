// Fictional, generated in the browser. Never contains downloaded player data.
const roster = [
  ['sample-player', '체험 플레이어', 0],
  ...Array.from({ length: 4 }, (_, i) => [`sample-ally-${i + 1}`, `팀원 ${i + 1}`, 0]),
  ...Array.from({ length: 5 }, (_, i) => [`sample-enemy-${i + 1}`, `상대 ${i + 1}`, 1]),
];
const teamOf = id => roster.find(player => player[0] === id)[2];
const nameOf = id => roster.find(player => player[0] === id)[1];

function round(no, winner, improved, offenseTeam) {
  const dead = new Map(), attacks = [];
  const attack = (attacker, victim, timeStamp) => {
    if (dead.has(attacker) || dead.has(victim)) return;
    dead.set(victim, timeStamp);
    attacks.push({ timeStamp, eventType: 0, attackerNexonSN: attacker, victimNexonSN: victim,
      attackerNickName: nameOf(attacker), victimNickName: nameOf(victim),
      attackerTeamNo: teamOf(attacker), victimTeamNo: teamOf(victim), itemName: '체험용 소총',
      attackerPosX: 100, attackerPosY: 100, victimPosX: 1000, victimPosY: 100 });
  };
  attack('sample-player', 'sample-enemy-1', 80);
  if (improved) attack('sample-player', 'sample-enemy-2', 160);
  if (!improved || winner === 1) attack('sample-enemy-3', 'sample-player', improved ? 320 : 180);
  const attacker = roster.find(([id, , team]) => team === winner && !dead.has(id))[0];
  let timeStamp = 400;
  for (const [id, , team] of roster) {
    if (team !== winner && !dead.has(id)) { attack(attacker, id, timeStamp); timeStamp += 30; }
  }
  return { no, offenseTeam, winTeam: winner, playTime: 60,
    replayAttackInfo: attacks, replayEnterInfo: [], replayBombInfo: [], replayThrowWeaponEventInfo: [
      { timeStamp: 50, nexonSN: 'sample-player', itemName: '체험용 투척물',
        firePosX: 0, firePosY: 0, posX: 800, posY: 300 },
    ],
    replayRoundSummaryInfo: roster.map(([nexonSN, nickName, teamNo]) => ({ nexonSN, nickName, teamNo,
      kill: attacks.filter(event => event.attackerNexonSN === nexonSN).length,
      death: dead.has(nexonSN) ? 1 : 0, breakType: 0, reJoin: 0 })),
    replayCharacterInfo: roster.map(([nexonSN], index) => ({ nexonSN, replayCharacterStateInfo: [
      { timeStamp: 0, state: 1, posX: index * 300, posY: index * 100 },
      { timeStamp: dead.get(nexonSN) ?? 600, state: dead.has(nexonSN) ? 2 : 1,
        posX: index * 300, posY: index * 100 },
    ] })),
  };
}

function replay(improved) {
  // Complete ranked matches: first half 3:1, second half 2:0. Both
  // stop as soon as the trailing team can no longer tie the aggregate.
  const winners = improved ? [0, 0, 1, 0, 0, 0] : [1, 0, 1, 1, 1, 1];
  const firstHalfWins = [0, 0];
  let offenseTeam = 0;
  const rounds = winners.map((winner, index) => {
    const result = round(index + 1, winner, improved, offenseTeam);
    if (offenseTeam === 0 && ++firstHalfWins[winner] === 3) offenseTeam = 1;
    return result;
  });
  return { replay_info: {
    replayMatchSummaryInfo: { matchType: 'R', changedTeam: 1, matchID: `fictional-sample-${improved ? 2 : 1}`,
      mapName: '체험용 가상 경기', matchDate: `2026-01-0${improved ? 2 : 1} PM 08:00`,
      winTeam: improved ? 0 : 1, teamAWinCnt: winners.filter(team => team === 0).length,
      teamBWinCnt: winners.filter(team => team === 1).length },
    replayCharacterSummaryInfo: roster.map(([nexonSN, nickName, teamNo]) => {
      const kill = rounds.reduce((sum, item) => sum + item.replayAttackInfo.filter(event => event.attackerNexonSN === nexonSN).length, 0);
      return { nexonSN, nickName, teamNo, kill,
        death: rounds.filter(item => item.replayAttackInfo.some(event => event.victimNexonSN === nexonSN)).length,
        assist: 0, damage: kill * 100 };
    }), replayRoundInfo: rounds,
  } };
}

export function createReplaySamples() {
  return [false, true].map((improved, index) => new File([JSON.stringify(replay(improved))],
    `가상-체험-${index + 1}.json`, { type: 'application/json' }));
}
