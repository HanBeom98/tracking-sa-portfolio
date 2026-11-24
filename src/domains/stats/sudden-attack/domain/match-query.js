/** An incomplete provider query must never be treated as a successful empty list. */
export class MatchQueryError extends Error {
  constructor(failures, total, kind = 'list') {
    const code = failures.length < total ? 'MATCH_QUERY_PARTIAL' : 'MATCH_QUERY_FAILED';
    super(code);
    this.name = 'MatchQueryError';
    this.code = code;
    this.queryKind = kind;
    this.failedCount = failures.length;
    this.totalCount = total;
    this.reasonCode = failures.some(error => error?.code === 'RATE_LIMITED') ? 'RATE_LIMITED'
      : failures.some(error => error?.code === 'REQUEST_TIMEOUT') ? 'REQUEST_TIMEOUT' : 'QUERY_FAILED';
  }
}

export function readMatchList(data) {
  if (!Array.isArray(data?.match)) {
    const error = new Error('INVALID_MATCH_LIST');
    error.code = 'INVALID_MATCH_LIST';
    throw error;
  }
  return data.match;
}
