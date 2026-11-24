import { makeError } from './errors.js?v=b5a12b75bd51';

export function getBoardNickname(profile) {
  const nickname = profile?.nickname;
  return typeof nickname === 'string' && /^[A-Za-z0-9가-힣_]{2,12}$/.test(nickname) ? nickname : '';
}

export function assertBoardNickname(profile) {
  const nickname = getBoardNickname(profile);
  if (!nickname) throw makeError('NICKNAME_REQUIRED');
  return nickname;
}
