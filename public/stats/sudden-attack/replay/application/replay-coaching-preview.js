const time = seconds => seconds.toFixed(1);
const card = (kind, title, observation, practice, limitation, refs) =>
  ({ kind, title, observation, practice, limitation, evidenceRefs: refs });

// Local templates exercise the response contract. No model, request or storage.
export function createMockReplayCoachingResponse(evidence) {
  if (evidence.status === 'insufficient_data') return { schemaVersion: 1, cards: [] };
  const rounds = evidence.rounds, m = evidence.metrics, cards = [];
  const made = rounds.find(r => r.tradesMade.examples.length);
  const opening = rounds.find(r => r.opening?.selectedKill);
  const kills = [...rounds].filter(r => r.kills > 0).sort((a, b) => b.kills - a.kills || a.round - b.round)[0];
  if (made) {
    const trade = made.tradesMade.examples[0];
    cards.push(card('strength', '교환킬 후보 장면에서 합류 흐름 찾기',
      `${made.round}라운드에서 팀원을 처치한 상대를 ${time(trade.gapSeconds)}초 뒤 처치한 기록이 있습니다.`,
      '해당 장면 전후에 팀원과 어떤 위치 관계였는지 복기하고, 반복할 수 있는 합류 행동을 한 가지 찾아보세요.',
      '기록상 교환킬 후보이며, 실제 시야나 의도적인 커버였는지는 확인할 수 없습니다.', [made.evidenceId]));
  } else if (opening) {
    cards.push(card('strength', '첫 처치 장면의 전후 흐름 확인하기',
      `${opening.round}라운드 ${time(opening.opening.timeSeconds)}초에 ${opening.opening.simultaneous ? '첫 처치들과 같은 시각의 처치' : '첫 처치'}를 기록했습니다.`,
      '첫 교전 직전의 대기 위치와 교전 후 이동을 비교해, 유지할 행동을 한 가지 정리해 보세요.',
      '첫 처치만으로 진입 판단이나 팀 기여 전체가 좋았다고 단정할 수는 없습니다.', [opening.evidenceId]));
  } else if (kills) {
    cards.push(card('strength', '처치가 있었던 장면에서 유지할 행동 찾기',
      `${kills.round}라운드에 ${kills.kills}킬을 기록했습니다.${kills.killsAfterDeath ? ` 사망 이후 처치 ${kills.killsAfterDeath}건이 포함됩니다.` : ''}`,
      '처치 직전과 직후를 비교해, 다음 경기에서도 재현해 볼 행동을 한 가지 골라보세요.',
      '처치 수만으로 좋은 판단이나 사망 이전의 교전 성과를 모두 설명하지는 못합니다.', [kills.evidenceId]));
  }

  const firstDeath = rounds.find(r => r.death?.opening);
  const received = rounds.find(r => r.tradesReceived.examples.length);
  const alone = rounds.find(r => r.alone);
  const death = rounds.find(r => r.death);
  if (firstDeath) {
    const d = firstDeath.death;
    cards.push(card('review', '첫 사망 장면을 먼저 복기하기',
      `${firstDeath.round}라운드 ${time(d.timeSeconds)}초, 본인 포함 ${d.ownAlive}대${d.enemyAlive}에서 ${d.simultaneous ? '첫 사망들과 같은 시각에 사망했습니다' : '첫 사망했습니다'}.`,
      '첫 교전 직전의 엄폐 위치와 팀원 합류 가능 여부를 확인하는 질문으로 해당 장면을 다시 보세요.',
      '첫 사망이라는 사실만으로 무리한 진입이나 라운드 패배의 책임을 판단할 수는 없습니다.', [firstDeath.evidenceId]));
  } else if (received) {
    const trade = received.tradesReceived.examples[0], d = received.death;
    cards.push(card('review', '사망 후 팀원의 대응까지 함께 보기',
      `${received.round}라운드 ${time(d.timeSeconds)}초에 본인 포함 ${d.ownAlive}대${d.enemyAlive}에서 사망했고, ${time(trade.gapSeconds)}초 뒤 팀원이 같은 상대를 처치했습니다.`,
      '사망 직전 엄폐와 팀원의 합류 위치를 함께 확인하고, 서로 대응할 시간을 만들 수 있었는지 복기해 보세요.',
      '교환킬 수혜 후보이며, 팀원의 거리·시야·실제 커버 의도는 확인할 수 없습니다.', [received.evidenceId]));
  } else if (alone) {
    cards.push(card('review', '혼자 남기 전 인원 변화 돌아보기',
      `${alone.round}라운드 ${time(alone.alone.timeSeconds)}초부터 1대${alone.alone.opponentsAlive} 상황에 남았고, 라운드 결과는 ${alone.result === 'win' ? '승리' : '패배'}였습니다.`,
      '혼자 남은 뒤의 결과뿐 아니라 직전에 팀 인원이 줄어든 흐름을 함께 확인해 보세요.',
      '혼자 남은 상황이나 그 결과만으로 개인 실력과 패배 책임을 단정할 수는 없습니다.', [alone.evidenceId]));
  } else if (death) {
    cards.push(card('review', '사망 시점의 상황을 질문으로 남기기',
      `${death.round}라운드 ${time(death.death.timeSeconds)}초에 본인 포함 ${death.death.ownAlive}대${death.death.enemyAlive}에서 사망했습니다.`,
      '사망 전후 기록을 보며 엄폐와 팀원 합류를 확인할 질문을 한 가지 적어보세요.',
      '기록만으로 조준 문제나 이동 실수 등 사망 원인을 특정할 수는 없습니다.', [death.evidenceId]));
  }
  cards.push(card('practice', '다음 경기에서 확인할 한 가지',
    `검증된 ${m.rounds}개 라운드에서 ${m.kills}킬·${m.deaths}사망, 평균 생존 ${time(m.averageSurvivalSeconds)}초를 기록했습니다.`,
    '다음 경기 3개 라운드에서 교전 직전 엄폐와 팀원 합류 가능 여부를 확인하고, 경기 후 체크 여부를 비교해 보세요.',
    '연습 제안이며 효과가 검증된 처방은 아닙니다. 이 경기의 기록을 장기적인 실력 평가로 일반화하지 않습니다.', ['verified-rounds']));
  return { schemaVersion: 1, cards };
}
