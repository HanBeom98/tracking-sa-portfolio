/**
 * Infra Client for sending Sudden Attack match notifications to Discord
 */
export class SaDiscordClient {
  constructor() {
    this.endpoint = '/api/discord-sa';
  }

  /**
   * Send match settlement results to Discord
   * @param {Object} match - The match record
   * @param {Array} playerChanges - Detailed changes for each player
   */
  async notifyMatchSettled(match, playerChanges) {
    try {
      const winColor = match.matchResult === 'WIN' ? 0xFF0000 : 0x00AAFF; // Red or Blue

      const embed = {
        title: `🎮 내전 정산 완료! (${match.mapName})`,
        description: `**결과: ${match.matchResult === 'WIN' ? '🔴 RED' : '🔵 BLUE'} TEAM 승리!**\n매치 ID: \`${match.matchId}\``,
        color: winColor,
        fields: [
          {
            name: '🏆 주요 성과',
            value: match.allPlayerStats.filter(p => p.isMvp).map(p => `⭐ **MVP**: ${p.nickname}`).join('\n') || '정보 없음',
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Tracking SA Match Analytics' }
      };

      const redTeamResults = playerChanges.filter(p => p.originalResult === 'WIN');
      const blueTeamResults = playerChanges.filter(p => p.originalResult === 'LOSE');

      if (redTeamResults.length > 0) {
        embed.fields.push({
          name: '🔴 RED TEAM 변동',
          value: redTeamResults.map(p => 
            `**${p.nickname}**: MMR ${p.mmrDiff > 0 ? '+' : ''}${p.mmrDiff} (${p.newMmr}) | HSR ${p.hsrDiff > 0 ? '+' : ''}${p.hsrDiff}`
          ).join('\n'),
          inline: false
        });
      }

      if (blueTeamResults.length > 0) {
        embed.fields.push({
          name: '🔵 BLUE TEAM 변동',
          value: blueTeamResults.map(p => 
            `**${p.nickname}**: MMR ${p.mmrDiff > 0 ? '+' : ''}${p.mmrDiff} (${p.newMmr}) | HSR ${p.hsrDiff > 0 ? '+' : ''}${p.hsrDiff}`
          ).join('\n'),
          inline: false
        });
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });

      return await response.json();
    } catch (error) {
      console.error('[DiscordClient] Failed to send notification:', error);
      return { error: error.message };
    }
  }
}
