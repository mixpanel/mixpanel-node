const jsonLogic = require("json-logic-js");
const { compareVersions } = require("compare-versions");

// Strict RFC3339 guard for datetime strings.
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

// SemVer 2.0.0 requires major.minor.patch; partial versions are zero-padded to this.
const SEMVER_PARTS = 3;

// Epoch milliseconds are compared as int64 elsewhere, so anything at or beyond this is out of range.
const MAX_EPOCH_MS = 9223372036854775808;

// Using the official semantic versioning 2.0.0 regular expression to handle cross-platform validation
// differences on other SDK's. For example, some platforms allow leading zeros even though it is not valid
// as part of the Semver 2.0.0 spec. See https://semver.org/
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

jsonLogic.add_operation("semver_compare", semverCompare);
jsonLogic.add_operation("datetime_compare", datetimeCompare);

// Implements a custom operation for semantic versioning comparison that conforms to the semver 2.0.0 standard.
// Prior to comparison, any leading version prefix is stripped.
function semverCompare(actual, symbol, target) {
  if (arguments.length !== 3) {
    return false;
  }
  if (typeof actual !== "string" || typeof target !== "string") {
    return false;
  }
  const actualVersion = normalizeSemver(actual);
  const targetVersion = normalizeSemver(target);
  if (!SEMVER_PATTERN.test(actualVersion) || !SEMVER_PATTERN.test(targetVersion)) {
    return false;
  }
  const cmp = compareVersions(actualVersion, targetVersion);
  return comparatorMatches(cmp, symbol);
}

// Implements a custom operation for datetime comparison.
// The target value stored on the feature flag is the millisecond epoch, whereas the actual value provided at evaluation time must be RFC-3339 formatted.
function datetimeCompare(actual, symbol, target) {
  if (arguments.length !== 3) {
    return false;
  }
  const actualSec = convertRfc3339ToUnixSeconds(actual);
  const targetSec = convertUnixMillisecondsToSeconds(target);
  if (actualSec === null || targetSec === null) {
    return false;
  }
  const cmp = actualSec - targetSec;
  return comparatorMatches(cmp, symbol);
}

function comparatorMatches(cmp, symbol) {
  switch (symbol) {
    case "=":
      return cmp === 0;
    case "!=":
      return cmp !== 0;
    case "<":
      return cmp < 0;
    case "<=":
      return cmp <= 0;
    case ">":
      return cmp > 0;
    case ">=":
      return cmp >= 0;
    default:
      return false;
  }
}

function normalizeSemver(version) {
  const stripped = version.trim().replace(/^[vV]/, "");

  let suffixStart = stripped.length;
  for (const separator of ["-", "+"]) {
    const index = stripped.indexOf(separator);
    if (index !== -1 && index < suffixStart) {
      suffixStart = index;
    }
  }

  const core = stripped.slice(0, suffixStart);
  const suffix = stripped.slice(suffixStart);

  const parts = core.split(".");
  while (parts.length < SEMVER_PARTS) {
    parts.push("0");
  }
  return parts.join(".") + suffix;
}

function convertRfc3339ToUnixSeconds(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (!RFC3339_PATTERN.test(normalized)) {
    return null;
  }
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) {
    return null;
  }
  return Math.floor(ms / 1000);
}

function convertUnixMillisecondsToSeconds(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  // A value int64 cannot represent is not a real timestamp; treating one as a bound would let a
  // nonsense target define a rollout window.
  if (value >= MAX_EPOCH_MS || value <= -MAX_EPOCH_MS) {
    return null;
  }
  return Math.trunc(value / 1000);
}

module.exports = {
  comparatorMatches,
  semverCompare,
  convertRfc3339ToUnixSeconds,
  convertUnixMillisecondsToSeconds,
  datetimeCompare,
};
