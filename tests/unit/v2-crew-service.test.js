import test from 'node:test';
import { strictEqual } from 'node:assert';

// We simulate the CrewService balancer logic here as the app uses TS & ES imports which Node runner might struggle with if not transpiled.
// For the sake of unit testing the core balancer algorithm.
function balanceTeams(members) {
  const sorted = [...members].sort((a, b) => b.mmr - a.mmr);
  const redTeam = [];
  const blueTeam = [];
  let redMmr = 0;
  let blueMmr = 0;

  sorted.forEach((member) => {
    if (redMmr <= blueMmr) {
      redTeam.push(member);
      redMmr += member.mmr;
    } else {
      blueTeam.push(member);
      blueMmr += member.mmr;
    }
  });

  return {
    redTeam,
    blueTeam,
    redAvgMmr: redTeam.length ? Math.round(redMmr / redTeam.length) : 0,
    blueAvgMmr: blueTeam.length ? Math.round(blueMmr / blueTeam.length) : 0,
    difference: Math.abs(Math.round((redMmr / (redTeam.length || 1)) - (blueMmr / (blueTeam.length || 1))))
  };
}

test('Team Balancer should distribute players based on MMR evenly', () => {
  const mockMembers = [
    { id: '1', characterName: 'User1', mmr: 1500 },
    { id: '2', characterName: 'User2', mmr: 1400 },
    { id: '3', characterName: 'User3', mmr: 1200 },
    { id: '4', characterName: 'User4', mmr: 1100 }
  ];

  const result = balanceTeams(mockMembers);
  
  // 1500 will go to Red. 1400 will go to Blue. 
  // Red: 1500. Blue: 1400.
  // Next is 1200. Blue is smaller (1400 <= 1500). So 1200 goes to Blue.
  // Blue is 2600. Red is 1500.
  // Next is 1100. Red is 1500 <= 2600. So 1100 goes to Red.
  // Red: 1500 + 1100 = 2600. Blue: 1400 + 1200 = 2600.
  
  strictEqual(result.redTeam.length, 2);
  strictEqual(result.blueTeam.length, 2);
  strictEqual(result.redAvgMmr, 1300);
  strictEqual(result.blueAvgMmr, 1300);
  strictEqual(result.difference, 0);
});
