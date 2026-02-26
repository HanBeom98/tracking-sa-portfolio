function resolveFuturesErrorKeys(area, error) {
  const message = error && typeof error.message === "string" ? error.message : "";
  const normalizedArea = area === "history" ? "history" : "analysis";
  const prefix = `${normalizedArea}_`;

  if (message === `${prefix}timeout`) {
    return {
      messageKey: `futures_${normalizedArea}_fail_timeout`,
      fallback: "요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.",
    };
  }
  if (message === `${prefix}network`) {
    return {
      messageKey: `futures_${normalizedArea}_fail_network`,
      fallback: "네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.",
    };
  }
  if (message.startsWith(`${prefix}http_`)) {
    return {
      messageKey: `futures_${normalizedArea}_fail_http`,
      fallback: "서버 응답 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
  if (message === `${prefix}empty`) {
    return {
      messageKey: `futures_${normalizedArea}_fail_empty`,
      fallback: "조회된 데이터가 없습니다.",
    };
  }

  return {
    messageKey: `futures_${normalizedArea}_fail`,
    fallback: normalizedArea === "analysis"
      ? "분석 데이터 조회 실패(CORS/소스 제한 가능). 위젯 시각 확인만 가능합니다."
      : "비교 데이터 조회 실패",
  };
}

export { resolveFuturesErrorKeys };
