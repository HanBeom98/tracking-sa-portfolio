// A page owns one session. Tickets prevent delayed file/sample work from
// committing after replacement, reset or disposal; comparison retains the result.
export function createReplayWorkspaceSession() {
  let replay = null, analysis = null, analysisReplay = null, isSample = false;
  let loadRevision = 0, sampleRevision = 0, disposed = false;
  function clearAnalysis() { analysis = null; analysisReplay = null; }
  function reset() {
    loadRevision++; sampleRevision++;
    replay = null; isSample = false; clearAnalysis();
  }
  return {
    get replay() { return replay; },
    get analysis() { return analysis; },
    get isSample() { return isSample; },
    beginLoad({ sample = false } = {}) {
      if (!sample) sampleRevision++;
      const ticket = ++loadRevision;
      replay = null; isSample = sample; clearAnalysis();
      return ticket;
    },
    isLoadCurrent(ticket) { return !disposed && ticket === loadRevision; },
    acceptReplay(ticket, value) {
      if (disposed || ticket !== loadRevision) return false;
      replay = value; return true;
    },
    failLoad(ticket) {
      if (disposed || ticket !== loadRevision) return;
      replay = null; isSample = false; clearAnalysis();
    },
    cancelLoad() { loadRevision++; },
    beginSample() { return ++sampleRevision; },
    isSampleCurrent(ticket) { return !disposed && ticket === sampleRevision; },
    cancelSample() { sampleRevision++; },
    canAnalyze(playerId) { return !disposed && Boolean(replay && playerId); },
    setAnalysis(value) {
      if (disposed || !replay) return;
      analysis = value; analysisReplay = replay;
    },
    currentAnalysis(playerId) {
      return !disposed && replay && analysisReplay === replay && analysis?.player.nexonSN === playerId ? analysis : null;
    },
    clearAnalysis, reset,
    dispose() { disposed = true; reset(); },
  };
}
