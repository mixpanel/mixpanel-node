/**
 * Utility functions for Mixpanel feature flags
 */
const crypto = require("crypto");
const { type } = require("os");

// Constants
const EXPOSURE_EVENT = "$experiment_started";

const REQUEST_HEADERS = {
  "Content-Type": "application/json",
};

/**
 * FNV-1a 64-bit hash function used for consistent variant assignment
 * https://www.ietf.org/archive/id/draft-eastlake-fnv-21.html#section-6.1.2
 * @param {Buffer} data - Data to hash
 * @returns {BigInt} - Hash value as BigInt
 */
function _fnv1a64(data) {
  const FNV_PRIME = BigInt("0x100000001B3");
  let hash = BigInt("0xCBF29CE484222325");

  for (let i = 0; i < data.length; i++) {
    hash ^= BigInt(data[i]);
    hash *= FNV_PRIME;
    hash &= BigInt("0xFFFFFFFFFFFFFFFF");
  }

  return hash;
}

/**
 * Normalized hash function that returns a value between 0.0 and 1.0
 * Used for variant assignment based on rollout percentages
 * @param {string} key - The key to hash (usually distinct_id or other identifier)
 * @param {string} salt - Salt value (usually flag-specific hash_salt)
 * @returns {number} - Hash value normalized to the non-inclusive range, [0.0, 1.0)
 */
function normalizedHash(key, salt) {
  const combined = Buffer.from(key + salt, "utf-8");
  const hashValue = _fnv1a64(combined);
  return Number(hashValue % BigInt(100)) / 100.0;
}

/**
 * Prepare common query parameters for feature flags API requests
 * @param {string} token - Mixpanel project token
 * @param {string} sdkVersion - SDK version string
 * @returns {Object} - Query parameters object
 */
function prepareCommonQueryParams(token, sdkVersion) {
  return {
    mp_lib: "node",
    $lib_version: sdkVersion,
    token: token,
  };
}

/**
 * Generate W3C traceparent header for distributed tracing
 * Format: 00-{trace-id}-{parent-id}-{trace-flags}
 * @returns {string} - traceparent header value
 */
function generateTraceparent() {
  const version = "00";
  const traceId = crypto.randomBytes(16).toString("hex");
  const parentId = crypto.randomBytes(8).toString("hex");
  const traceFlags = "01"; // sampled

  return `${version}-${traceId}-${parentId}-${traceFlags}`;
}

function lowercaseAllKeysAndValues(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  } 
  else if (typeof obj === "string") {
    return obj.toLowerCase();
  } 
  else if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      return obj.map(lowercaseAllKeysAndValues);
    } else {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
          k.toLowerCase(),
          lowercaseAllKeysAndValues(v),
        ]),
      );
    }
  } 
  else {
    return obj;
  }
}

module.exports = {
  EXPOSURE_EVENT,
  REQUEST_HEADERS,
  normalizedHash,
  prepareCommonQueryParams,
  generateTraceparent,
  lowercaseAllKeysAndValues,
};
