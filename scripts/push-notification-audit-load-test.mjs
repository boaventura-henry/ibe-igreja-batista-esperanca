import assert from "node:assert/strict";

const statuses = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  SKIPPED: "SKIPPED"
};

function simulateOriginal(count, failureEvery = 4) {
  return Array.from({ length: count }, (_, index) => ({
    deviceId: `device-${index + 1}`,
    endpointHash: `hash-${index + 1}`,
    status: (index + 1) % failureEvery === 0 ? statuses.FAILED : statuses.SUCCESS,
    attemptNumber: 0
  }));
}

function buildLaterSuccessSet(chain, sourceRetryNumber) {
  const keys = new Set();
  for (const attempt of chain) {
    if (attempt.retryNumber <= sourceRetryNumber) continue;
    for (const device of attempt.devices) {
      if (device.status !== statuses.SUCCESS) continue;
      keys.add(`device:${device.deviceId}`);
      keys.add(`hash:${device.endpointHash}`);
    }
  }
  return keys;
}

function retryFailed(sourceAttempt, chain, options = {}) {
  const laterSuccess = buildLaterSuccessSet(chain, sourceAttempt.retryNumber);
  const lockKey = sourceAttempt.originalLogId ?? sourceAttempt.id;
  if (options.activeLocks?.has(lockKey)) {
    return { code: 409, reason: "RETRY_ALREADY_PROCESSING" };
  }
  options.activeLocks?.add(lockKey);
  try {
    const failed = sourceAttempt.devices.filter((device) => device.status === statuses.FAILED);
    const devices = failed.map((device) => {
      if (laterSuccess.has(`device:${device.deviceId}`) || laterSuccess.has(`hash:${device.endpointHash}`)) {
        return { ...device, status: statuses.SKIPPED, skipReason: "ALREADY_SUCCEEDED_IN_LATER_ATTEMPT", attemptNumber: sourceAttempt.retryNumber + 1 };
      }
      return { ...device, status: options.failAll ? statuses.FAILED : statuses.SUCCESS, attemptNumber: sourceAttempt.retryNumber + 1 };
    });
    return {
      code: 200,
      log: {
        id: `retry-${sourceAttempt.retryNumber + 1}`,
        originalLogId: sourceAttempt.originalLogId ?? sourceAttempt.id,
        retrySourceLogId: sourceAttempt.id,
        retryNumber: sourceAttempt.retryNumber + 1,
        devices
      }
    };
  } finally {
    options.activeLocks?.delete(lockKey);
  }
}

function consolidate(chain) {
  const map = new Map();
  for (const attempt of chain) {
    for (const device of attempt.devices) {
      const key = device.deviceId ?? device.endpointHash;
      const current = map.get(key);
      if (!current || current.status !== statuses.SUCCESS) map.set(key, { status: device.status, attempt: attempt.retryNumber });
    }
  }
  return map;
}

for (const size of [10, 50, 100, 200]) {
  const original = { id: `original-${size}`, originalLogId: null, retryNumber: 0, devices: simulateOriginal(size) };
  const failedCount = original.devices.filter((device) => device.status === statuses.FAILED).length;
  const firstRetry = retryFailed(original, [original]);
  assert.equal(firstRetry.code, 200);
  assert.equal(firstRetry.log.devices.length, failedCount);
  assert.equal(firstRetry.log.retryNumber, 1);
  assert.equal(firstRetry.log.originalLogId, original.id);
  assert.equal(firstRetry.log.devices.filter((device) => device.status === statuses.SUCCESS).length, failedCount);
  const chain = [original, firstRetry.log];
  const secondRetry = retryFailed(original, chain);
  assert.equal(secondRetry.code, 200);
  assert.equal(secondRetry.log.devices.filter((device) => device.status === statuses.SKIPPED).length, failedCount);
  assert.equal(consolidate(chain).size, size);
}

const activeLocks = new Set();
const original = { id: "original-concurrency", originalLogId: null, retryNumber: 0, devices: simulateOriginal(20, 2) };
activeLocks.add(original.id);
const blocked = retryFailed(original, [original], { activeLocks });
assert.equal(blocked.code, 409);
assert.equal(blocked.reason, "RETRY_ALREADY_PROCESSING");
activeLocks.clear();
const accepted = retryFailed(original, [original], { activeLocks });
assert.equal(accepted.code, 200);
assert.equal(activeLocks.size, 0);

console.log("push audit load/concurrency simulation passed");
