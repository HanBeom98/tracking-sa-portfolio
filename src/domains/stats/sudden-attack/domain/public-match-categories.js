export const PUBLIC_MATCH_CATEGORY_CONFIG = Object.freeze({
  all: Object.freeze({
    key: 'all',
    label: '전체',
    matchTypes: Object.freeze([
      '랭크전 솔로',
      '랭크전 파티',
      '퀵매치 클랜전',
      '클랜전',
      '토너먼트'
    ])
  }),
  solo: Object.freeze({ key: 'solo', label: '솔로랭크', matchTypes: Object.freeze(['랭크전 솔로']) }),
  party: Object.freeze({ key: 'party', label: '파티랭크', matchTypes: Object.freeze(['랭크전 파티']) }),
  clan: Object.freeze({ key: 'clan', label: '클랜전', matchTypes: Object.freeze(['퀵매치 클랜전', '클랜전']) }),
  tournament: Object.freeze({ key: 'tournament', label: '토너먼트', matchTypes: Object.freeze(['토너먼트']) })
});

export function normalizePublicMatchCategory(category = 'all') {
  return Object.hasOwn(PUBLIC_MATCH_CATEGORY_CONFIG, category) ? category : 'all';
}

export function getPublicMatchCategory(category = 'all') {
  return PUBLIC_MATCH_CATEGORY_CONFIG[normalizePublicMatchCategory(category)];
}
