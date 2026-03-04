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
      
      this.allPlayerStats = statsArray.map(p => {
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
          const nameMatches = targetUserName && normalizedName === targetUserName.toLowerCase().trim();
          const statsMatch = killValue === parseInt(subjectInfo.kill) && deathValue === parseInt(subjectInfo.death) && String(resultValue) === String(subjectInfo.result);
          if (nameMatches || statsMatch) { isSubject = true; subjectFound = true; }
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
          result: resultValue === "1" ? "WIN" : (resultValue === "2" ? "LOSE" : "UNKNOWN"),
          isCrew: isCrew, ouid: isSubject ? subjectInfo.ouid : (p.ouid || null)
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
      const playerStat = target 
        ? (statsArray.find(p => (p.user_name || p.character_name || "").toLowerCase().trim() === target) || statsArray[0])
        : statsArray[0];

      this.matchResult = String(playerStat.match_result || playerStat.result) === "1" ? "WIN" : "LOSE";
      this.kill = parseInt(playerStat.kill || 0);
      this.death = parseInt(playerStat.death || 0);
      this.assist = parseInt(playerStat.assist || 0);
      this.damage = parseInt(playerStat.damage || 0);
      this.headshot = parseInt(playerStat.headshot || 0);
      this.kdPercent = (this.kill + this.death > 0) ? Math.round((this.kill / (this.kill + this.death)) * 100) : 0;

      // 검색된 대상 유저가 크루원인지 여부 저장
      const targetInStats = this.allPlayerStats.find(p => p.nickname === playerStat.user_name || p.nickname === playerStat.character_name);
      this.isTargetCrew = targetInStats ? targetInStats.isCrew : false;
    }

    const winTeam = this.allPlayerStats.filter(p => p.result === 'WIN');
    const loseTeam = this.allPlayerStats.filter(p => p.result === 'LOSE');
    const winTeamMissing = Math.max(0, loseTeam.reduce((s, p) => s + p.kill, 0) - winTeam.reduce((s, p) => s + p.death, 0));
    const loseTeamMissing = Math.max(0, winTeam.reduce((s, p) => s + p.kill, 0) - loseTeam.reduce((s, p) => s + p.death, 0));
    this.laundryInfo = { isWashed: winTeamMissing > 0 || loseTeamMissing > 0, totalMissing: winTeamMissing + loseTeamMissing, winTeamMissing, loseTeamMissing };
  }
}
