const { AsyncLocalStorage } = require("async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();
const metrics = [];

function runWithMetrics(context, callback) {
  return asyncLocalStorage.run(context, callback);
}

function getCurrentContext() {
  return asyncLocalStorage.getStore();
}

function incrementDbQueries() {
  const context = getCurrentContext();

  if (context) {
    context.dbQueries += 1;
  }
}

function setMetricData(data) {
  const context = getCurrentContext();

  if (context) {
    context.data = {
      ...context.data,
      ...data
    };
  }
}

function addMetric(metric) {
  metrics.push({
    ...metric,
    method: String(metric.method || "").toLowerCase(),
    type: String(metric.type || "").toLowerCase()
  });
}

function getMetrics() {
  return [...metrics];
}

function clearMetrics() {
  metrics.length = 0;
}

function summarizeMetrics(records = metrics) {
  const groups = records.reduce((acc, item) => {
    const method = String(item.method || "").toLowerCase();
    const type = String(item.type || "").toLowerCase();
    const key = `${method}:${type}`;

    if (!acc[key]) {
      acc[key] = {
        method,
        type,
        count: 0,
        totalResponseTime: 0,
        minResponseTime: Number.POSITIVE_INFINITY,
        maxResponseTime: 0,
        totalDbQueries: 0,
        totalTokenSize: 0,
        tokenSizeCount: 0,
        totalCookieSize: 0,
        totalAuthorizationSize: 0
      };
    }

    acc[key].count += 1;
    acc[key].totalResponseTime += item.responseTime;
    acc[key].minResponseTime = Math.min(acc[key].minResponseTime, item.responseTime);
    acc[key].maxResponseTime = Math.max(acc[key].maxResponseTime, item.responseTime);
    acc[key].totalDbQueries += item.dbQueries;
    acc[key].totalCookieSize += item.cookieSize || 0;
    acc[key].totalAuthorizationSize += item.authorizationBytes || item.authorizationHeaderSize || 0;

    if (item.tokenSize) {
      acc[key].totalTokenSize += item.tokenSize;
      acc[key].tokenSizeCount += 1;
    }

    return acc;
  }, {});

  return Object.values(groups).map((group) => ({
    method: group.method,
    type: group.type,
    count: group.count,
    avgResponseTime: Number((group.totalResponseTime / group.count).toFixed(2)),
    minResponseTime: Number(group.minResponseTime.toFixed(2)),
    maxResponseTime: Number(group.maxResponseTime.toFixed(2)),
    totalDbQueries: group.totalDbQueries,
    avgDbQueries: Number((group.totalDbQueries / group.count).toFixed(2)),
    avgTokenSize: group.tokenSizeCount
      ? Number((group.totalTokenSize / group.tokenSizeCount).toFixed(2))
      : 0,
    avgCookieSize: Number((group.totalCookieSize / group.count).toFixed(2)),
    avgAuthorizationHeaderSize: Number((group.totalAuthorizationSize / group.count).toFixed(2))
  }));
}

module.exports = {
  runWithMetrics,
  getCurrentContext,
  incrementDbQueries,
  setMetricData,
  addMetric,
  getMetrics,
  clearMetrics,
  summarizeMetrics
};
