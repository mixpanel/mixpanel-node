const jsonLogic = require("json-logic-js");

// Strict RFC3339 guard for datetime strings. The date and hour fields are captured so the calendar
// can be validated separately; the pattern only constrains their shape.
const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

// SemVer 2.0.0 requires major.minor.patch; partial versions are zero-padded to this.
const SEMVER_PARTS = 3;

// Longest operand the semver regex is allowed to see. A real version never approaches this; the
// bound matches MAX_LENGTH in node-semver, and keeps an arbitrarily long property value off the
// regex regardless of how the engine schedules backtracking.
const MAX_SEMVER_LENGTH = 256;

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
  if (actual.length > MAX_SEMVER_LENGTH || target.length > MAX_SEMVER_LENGTH) {
    return false;
  }
  const actualVersion = normalizeSemver(actual);
  const targetVersion = normalizeSemver(target);
  if (
    !SEMVER_PATTERN.test(actualVersion) ||
    !SEMVER_PATTERN.test(targetVersion)
  ) {
    return false;
  }
  const cmp = compareSemver(actualVersion, targetVersion);
  return comparatorMatches(cmp, symbol);
}

// Strip optional build metadata and separate the core version from pre-release identifiers
function splitSemver(version) {
  const plus = version.indexOf("+");
  if (plus !== -1) {
    version = version.slice(0, plus);
  }
  const dash = version.indexOf("-");
  if (dash === -1) {
    return { core: version.split("."), prerelease: [] };
  }
  return {
    core: version.slice(0, dash).split("."),
    prerelease: version.slice(dash + 1).split("."),
  };
}

function isNumericIdentifier(identifier) {
  return /^[0-9]+$/.test(identifier);
}

// Numeric identifiers carry no leading zeros, so the longer run of digits is the larger number.
// Comparing them as digits rather than as numbers keeps versions past Number.MAX_SAFE_INTEGER
// ordered correctly.
function compareNumeric(a, b) {
  if (a.length !== b.length) {
    return a.length < b.length ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

// SemVer 2.0.0 section 11.4: digits compare numerically, a numeric identifier ranks below an
// alphanumeric one, and anything else compares by ASCII order.
function comparePrereleaseIdentifier(a, b) {
  const aNumeric = isNumericIdentifier(a);
  const bNumeric = isNumericIdentifier(b);
  if (aNumeric && bNumeric) {
    return compareNumeric(a, b);
  }
  if (aNumeric) {
    return -1;
  }
  if (bNumeric) {
    return 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

// Ordering per SemVer 2.0.0 section 11. Both operands have already been normalized and matched
// against the official regex, so the core holds exactly three numeric identifiers and every
// prerelease field is well-formed; the split needs no error path.
function compareSemver(actualVersion, targetVersion) {
  const actual = splitSemver(actualVersion);
  const target = splitSemver(targetVersion);

  for (let i = 0; i < actual.core.length; i++) {
    const result = compareNumeric(actual.core[i], target.core[i]);
    if (result !== 0) {
      return result;
    }
  }

  // A prerelease ranks below the release it belongs to (section 11.3).
  if (!actual.prerelease.length && !target.prerelease.length) {
    return 0;
  }
  if (!actual.prerelease.length) {
    return 1;
  }
  if (!target.prerelease.length) {
    return -1;
  }

  const shared = Math.min(actual.prerelease.length, target.prerelease.length);
  for (let i = 0; i < shared; i++) {
    const result = comparePrereleaseIdentifier(
      actual.prerelease[i],
      target.prerelease[i],
    );
    if (result !== 0) {
      return result;
    }
  }
  // Every field so far is equal, so the longer list wins (section 11.4.4).
  if (actual.prerelease.length !== target.prerelease.length) {
    return actual.prerelease.length < target.prerelease.length ? -1 : 1;
  }
  return 0;
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
    case "===":
      return cmp === 0;
    case "!==":
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

function daysInMonth(year, month) {
  if (month === 2) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeapYear ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

// The pattern constrains each field to two digits, which still admits a date that cannot exist, such
// as 2026-02-30 or 29 February in a common year. Date.parse rolls those forward into a real instant
// instead of rejecting them, and hour 24 likewise becomes the following midnight, so the calendar is
// checked here rather than left to the engine. RFC 3339 section 5.6 allows hours 00 through 23.
function isRealCalendarDate(year, month, day, hour) {
  if (month < 1 || month > 12 || day < 1 || hour > 23) {
    return false;
  }
  return day <= daysInMonth(year, month);
}

function convertRfc3339ToUnixSeconds(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  const fields = RFC3339_PATTERN.exec(normalized);
  if (!fields) {
    return null;
  }
  const [, year, month, day, hour] = fields;
  if (
    !isRealCalendarDate(Number(year), Number(month), Number(day), Number(hour))
  ) {
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
