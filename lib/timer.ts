import { ExtensionCache } from "./extension";

const GL_QUERY_RESULT_EXT = 0x8866;
const GL_QUERY_RESULT_AVAILABLE_EXT = 0x8867;
const GL_TIME_ELAPSED_EXT = 0x88bf;

interface WebGLQuery {
  ____opaque: 9999;
}

export default function createTimer(extensions: ExtensionCache) {
  const ext: {
    createQueryEXT(): WebGLQuery;
    deleteQueryEXT(query: WebGLQuery): void;
    beginQueryEXT(type: number, query: WebGLQuery): void;
    endQueryEXT(type: number): void;
    getQueryObjectEXT(query: WebGLQuery, type: number): number;
  } = extensions.ext_disjoint_timer_query as any;

  if (!ext) {
    return null;
  }

  // QUERY POOL BEGIN
  const queryPool: WebGLQuery[] = [];
  function allocQuery() {
    return queryPool.pop() || ext.createQueryEXT();
  }
  function freeQuery(query: WebGLQuery) {
    queryPool.push(query);
  }
  // QUERY POOL END

  const pendingQueries: WebGLQuery[] = [];
  function beginQuery(stats: any) {
    const query = allocQuery();
    ext.beginQueryEXT(GL_TIME_ELAPSED_EXT, query);
    pendingQueries.push(query);
    pushScopeStats(pendingQueries.length - 1, pendingQueries.length, stats);
  }

  function endQuery() {
    ext.endQueryEXT(GL_TIME_ELAPSED_EXT);
  }

  //
  // Pending stats pool.
  //
  class PendingStats {
    startQueryIndex = -1;
    endQueryIndex = -1;
    sum = 0;
    stats: any = null;
  }
  const pendingStatsPool: PendingStats[] = [];
  function allocPendingStats() {
    return pendingStatsPool.pop() || new PendingStats();
  }
  function freePendingStats(pendingStats: PendingStats) {
    pendingStatsPool.push(pendingStats);
  }
  // Pending stats pool end

  const pendingStats: PendingStats[] = [];
  function pushScopeStats(start: number, end: number, stats: any) {
    const ps = allocPendingStats();
    ps.startQueryIndex = start;
    ps.endQueryIndex = end;
    ps.sum = 0;
    ps.stats = stats;
    pendingStats.push(ps);
  }

  // we should call this at the beginning of the frame,
  // in order to update gpuTime
  const timeSum: number[] = [];
  const queryPtr: number[] = [];
  function update() {
    const n = pendingQueries.length;
    if (n === 0) {
      return;
    }

    // Reserve space
    queryPtr.length = Math.max(queryPtr.length, n + 1);
    timeSum.length = Math.max(timeSum.length, n + 1);
    timeSum[0] = 0;
    queryPtr[0] = 0;

    // Update all pending timer queries
    let queryTime = 0;
    let timerPtr = 0;
    for (let i = 0; i < pendingQueries.length; ++i) {
      const query = pendingQueries[i];
      if (ext.getQueryObjectEXT(query, GL_QUERY_RESULT_AVAILABLE_EXT)) {
        queryTime += ext.getQueryObjectEXT(query, GL_QUERY_RESULT_EXT);
        freeQuery(query);
      } else {
        pendingQueries[timerPtr++] = query;
      }
      timeSum[i + 1] = queryTime;
      queryPtr[i + 1] = timerPtr;
    }
    pendingQueries.length = timerPtr;

    // Update all pending stat queries
    let statPtr = 0;
    for (let i = 0; i < pendingStats.length; ++i) {
      const stats = pendingStats[i];
      const start = stats.startQueryIndex;
      const end = stats.endQueryIndex;
      stats.sum += timeSum[end] - timeSum[start];
      const startPtr = queryPtr[start];
      const endPtr = queryPtr[end];
      if (endPtr === startPtr) {
        stats.stats.gpuTime += stats.sum / 1e6;
        freePendingStats(stats);
      } else {
        stats.startQueryIndex = startPtr;
        stats.endQueryIndex = endPtr;
        pendingStats[statPtr++] = stats;
      }
    }
    pendingStats.length = statPtr;
  }

  return {
    beginQuery,
    endQuery,
    pushScopeStats,
    update,
    getNumPendingQueries() {
      return pendingQueries.length;
    },
    clear() {
      queryPool.push.apply(queryPool, pendingQueries);
      for (let i = 0; i < queryPool.length; i++) {
        ext.deleteQueryEXT(queryPool[i]);
      }
      pendingQueries.length = 0;
      queryPool.length = 0;
    },
    restore() {
      pendingQueries.length = 0;
      queryPool.length = 0;
    }
  };
}
