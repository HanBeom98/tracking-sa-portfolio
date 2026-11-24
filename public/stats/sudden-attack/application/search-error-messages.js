export const PLAYER_NOT_FOUND_MESSAGE = [
  '캐릭터를 찾을 수 없습니다.',
  '',
  '병영수첩에 존재하는 한 글자 닉네임 또는 외부 표시명은 넥슨 Open API에서 조회되지 않을 수 있습니다.',
  '이 경우 실제 닉네임으로 다시 검색해 주세요.'
].join('\n');

export function resolvePlayerNotFoundMessage(error) {
  return error?.message === 'PLAYER_NOT_FOUND' ? PLAYER_NOT_FOUND_MESSAGE : null;
}

export function resolveMatchQueryMessage(error, fallback = '경기 기록을 불러오지 못했습니다.') {
  const partial = error?.code === 'MATCH_QUERY_PARTIAL';
  const subject = error?.queryKind === 'detail' ? '경기 상세 기록' : '경기 유형';
  const reason = error?.reasonCode || error?.code;
  const wait = reason === 'RATE_LIMITED' ? '요청이 많아 잠시 기다려야 합니다.'
    : reason === 'REQUEST_TIMEOUT' ? '응답 대기 시간이 초과되었습니다.' : '';
  const message = partial ? `일부 ${subject}을 불러오지 못했습니다.` : fallback;
  return `${message} ${wait} 잠시 후 다시 시도해 주세요.`.replace(/ +/g, ' ');
}

export function resolvePublicSearchError(error) {
  if (error?.code === 'MATCH_QUERY_PARTIAL' || error?.code === 'MATCH_QUERY_FAILED') {
    return {
      title: error.code === 'MATCH_QUERY_PARTIAL' ? '일부 경기 기록을 확인하지 못했습니다.' : '경기 기록 조회에 실패했습니다.',
      message: resolveMatchQueryMessage(error)
    };
  }
  const notFoundMessage = resolvePlayerNotFoundMessage(error);
  if (notFoundMessage) {
    const [title, ...body] = notFoundMessage.split('\n');
    return { title, message: body.join('\n').trim() };
  }
  if (error?.message === 'TEST_KEY_LIMITATION') {
    return {
      title: '이 캐릭터의 전적을 조회할 수 없습니다.',
      message: '현재 조회 가능한 캐릭터가 제한되어 있습니다. 다른 닉네임으로 다시 검색해 주세요.'
    };
  }
  if (error?.code === 'REQUEST_TIMEOUT') {
    return { title: '전적 조회 응답이 늦어지고 있습니다.', message: '요청 대기 시간이 초과되었습니다. 잠시 후 검색 버튼을 눌러 다시 시도해 주세요.' };
  }
  if (error?.code === 'RATE_LIMITED') {
    return { title: '전적 조회 요청이 잠시 제한되었습니다.', message: '요청이 많아 잠시 기다려야 합니다. 잠시 후 검색 버튼을 눌러 다시 시도해 주세요.' };
  }
  return {
    title: '전적을 불러오지 못했습니다.',
    message: '일시적인 연결 오류일 수 있습니다. 잠시 후 검색 버튼을 눌러 다시 시도해 주세요.'
  };
}
