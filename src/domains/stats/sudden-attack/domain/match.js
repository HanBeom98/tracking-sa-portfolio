export function normalizeMatchResult(value) {
  const result = String(value ?? '').trim().toUpperCase();
  if (result === '1' || result === 'WIN') return 'WIN';
  if (result === '2' || result === 'LOSE') return 'LOSE';
  if (result === '3' || result === 'DRAW') return 'DRAW';
  return 'UNKNOWN';
}

export function toNexonMatchResult(value) {
  return { WIN: '1', LOSE: '2', DRAW: '3' }[normalizeMatchResult(value)] || '0';
}

// Draws give every player the same result; only team IDs can distinguish sides.
export function getMatchTeamPlayers(match, { nickname = '', opponents = false } = {}) {
  const players = Array.isArray(match.allPlayerStats) ? match.allPlayerStats : [];
  const subject = players.find(p => p.isSubject)
    || players.find(p => nickname && p.nickname?.toLowerCase().trim() === nickname.toLowerCase().trim());
  const teamId = match.subjectTeamId ?? subject?.teamId;
  if (teamId !== undefined && teamId !== null && String(teamId) !== '') {
    return players.filter(p => p.teamId !== null && p.teamId !== undefined
      && String(p.teamId) !== '' && (String(p.teamId) === String(teamId)) !== opponents);
  }
  if (match.matchResult !== 'WIN' && match.matchResult !== 'LOSE') return [];
  const result = opponents ? (match.matchResult === 'WIN' ? 'LOSE' : 'WIN') : match.matchResult;
  return players.filter(p => p.result === result);
}

export class MatchRecord {
  constructor(detail, typeName = "", targetUserName = "", crewData = { names: [], ouids: [] }, subjectInfo = null) {
    this.matchId = detail.match_id;
    this.matchTypeName = typeName;
    this.mapName = detail.match_map || detail.map_name || "Unknown Map";
    this.matchDate = detail.date_match || detail.match_date;
    this.participants = [];
    this.crewParticipants = [];
    this.isCustomMatch = false;
    this.allPlayerStats = []; 

    const statsArray = detail.match_detail || detail.match_member || [];

    if (Array.isArray(statsArray)) {
      let subjectFound = false;
      const crewNamesSet = new Set((crewData.names || []).map(n => (n || "").toLowerCase().trim()));
      const normalizedTarget = (targetUserName || "").toLowerCase().trim();
      const subjectOuid = String(subjectInfo?.ouid || "").trim();
      const hasSubjectOuid = !!subjectOuid && statsArray.some((row) => String(row.ouid || "").trim() === subjectOuid);
      const hasTargetName = !!normalizedTarget && statsArray.some((row) => {
        const rowName = (row.user_name || row.character_name || "").toLowerCase().trim();
        return rowName === normalizedTarget;
      });
      const subjectSignature = subjectInfo
        ? `${parseInt(subjectInfo.kill || 0)}|${parseInt(subjectInfo.death || 0)}|${String(subjectInfo.result || "")}`
        : null;
      const signatureCount = new Map();
      if (subjectSignature) {
        statsArray.forEach((row) => {
          const rowKill = parseInt(row.kill || row.kill_count || row.cnt_kill || 0);
          const rowDeath = parseInt(row.death || row.death_count || row.cnt_death || 0);
          const rowResult = String(row.match_result || row.result || "0");
          const sig = `${rowKill}|${rowDeath}|${rowResult}`;
          signatureCount.set(sig, (signatureCount.get(sig) || 0) + 1);
        });
      }
      
      let subjectRowIndex = -1;
      this.allPlayerStats = statsArray.map((p, rowIndex) => {
        const nickname = p.user_name || p.character_name || "";
        const normalizedName = nickname.toLowerCase().trim();
        const killValue = parseInt(p.kill || p.kill_count || p.cnt_kill || 0);
        const deathValue = parseInt(p.death || p.death_count || p.cnt_death || 0);
        const assistValue = parseInt(p.assist || p.assist_count || p.cnt_assist || 0);
        const resultValue = String(p.match_result || p.result || "0");
        
        const damageValue = parseInt(p.damage || p.cnt_damage || 0);
        const headshotValue = parseInt(p.headshot || p.cnt_headshot || 0);

        let isSubject = false;
        if (subjectInfo && !subjectFound) {
          if (hasSubjectOuid) {
            if (String(p.ouid || "").trim() === subjectOuid) {
              isSubject = true;
              subjectFound = true;
              subjectRowIndex = rowIndex;
            }
          } else if (hasTargetName) {
            if (normalizedName === normalizedTarget) {
              isSubject = true;
              subjectFound = true;
              subjectRowIndex = rowIndex;
            }
          } else if (subjectSignature) {
            const currentSignature = `${killValue}|${deathValue}|${String(resultValue)}`;
            const isUniqueFallback = currentSignature === subjectSignature && (signatureCount.get(currentSignature) || 0) === 1;
            if (isUniqueFallback) {
              isSubject = true;
              subjectFound = true;
              subjectRowIndex = rowIndex;
            }
          }
        }
        const isCrew = isSubject || crewNamesSet.has(normalizedName) || (p.ouid && (crewData.ouids || []).includes(p.ouid));
        const totalEngagements = killValue + deathValue;
        const kdPercent = totalEngagements > 0 ? Math.round((killValue / totalEngagements) * 100) : 0;
        const hsPercent = killValue > 0 ? Math.round((headshotValue / killValue) * 100) : 0;
        
        return {
          nickname: nickname, 
          kill: killValue, 
          death: deathValue, 
          assist: assistValue,
          damage: damageValue,
          headshot: headshotValue,
          hsPercent: hsPercent,
          kd: deathValue > 0 ? (killValue / deathValue).toFixed(2) : (killValue > 0 ? killValue.toFixed(2) : "0.00"),
          kdPercent: kdPercent,
          result: normalizeMatchResult(resultValue),
          teamId: p.team_id === undefined || p.team_id === null ? null : String(p.team_id),
          isCrew: isCrew,
          isSubject,
          ouid: isSubject ? subjectInfo.ouid : (p.ouid || null)
        };
      });

      let bestScore = -1;
      let mvp = null;
      this.allPlayerStats.forEach(p => {
        const score = (p.kill * 100) + p.damage + (p.headshot * 150);
        if (p.kill >= 5 && score > bestScore) {
          bestScore = score;
          mvp = p.nickname;
        }
      });
      this.allPlayerStats.forEach(p => { if (p.nickname === mvp) p.isMvp = true; });

      this.participants = statsArray.map(p => p.user_name || p.character_name);
      this.crewParticipants = this.allPlayerStats.filter(p => p.isCrew).map(p => p.nickname);
      if (this.crewParticipants.length >= 8) this.isCustomMatch = true;
      
      const target = targetUserName ? targetUserName.toLowerCase().trim() : "";
      const playerStat = (subjectRowIndex >= 0
        ? statsArray[subjectRowIndex]
        : target
          ? (statsArray.find(p => (p.user_name || p.character_name || "").toLowerCase().trim() === target) || subjectInfo || statsArray[0])
          : (subjectInfo || statsArray[0])) || detail;

      this.matchResult = normalizeMatchResult(playerStat.match_result ?? playerStat.result ?? detail.match_result);
      this.subjectTeamId = playerStat.team_id === undefined || playerStat.team_id === null ? null : String(playerStat.team_id);
      this.kill = parseInt(playerStat.kill || 0);
      this.death = parseInt(playerStat.death || 0);
      this.assist = parseInt(playerStat.assist || 0);
      this.damage = parseInt(playerStat.damage || 0);
      this.headshot = parseInt(playerStat.headshot || 0);
      this.kdPercent = (this.kill + this.death > 0) ? Math.round((this.kill / (this.kill + this.death)) * 100) : 0;

      // 검색된 대상 유저가 크루원인지 여부 저장 (정규화된 이름으로 비교)
      const targetName = (playerStat.user_name || playerStat.character_name || "").toLowerCase().trim();
      const targetInStats = this.allPlayerStats.find(p => (p.nickname || "").toLowerCase().trim() === targetName);
      this.isTargetCrew = targetInStats ? targetInStats.isCrew : false;

      // MMR/HSR 변동 수치 저장 (정산 데이터가 있는 경우)
      this.mmrChange = subjectInfo ? Number(subjectInfo.mmrChange || 0) : 0;
      this.hsrChange = subjectInfo ? Number(subjectInfo.hsrChange || 0) : 0;
    }

    const winTeam = this.allPlayerStats.filter(p => p.result === 'WIN');
    const loseTeam = this.allPlayerStats.filter(p => p.result === 'LOSE');
    const decisive = this.matchResult === 'WIN' || this.matchResult === 'LOSE';
    const winTeamMissing = decisive ? Math.max(0, loseTeam.reduce((s, p) => s + p.kill, 0) - winTeam.reduce((s, p) => s + p.death, 0)) : 0;
    const loseTeamMissing = decisive ? Math.max(0, winTeam.reduce((s, p) => s + p.kill, 0) - loseTeam.reduce((s, p) => s + p.death, 0)) : 0;
    this.laundryInfo = { isWashed: winTeamMissing > 0 || loseTeamMissing > 0, totalMissing: winTeamMissing + loseTeamMissing, winTeamMissing, loseTeamMissing };
  }
}
