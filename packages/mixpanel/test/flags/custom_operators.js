const { apply } = require("json-logic-js");
// Requiring the module registers semver_compare and datetime_compare on the shared
// json-logic-js instance used by apply().
require("../../lib/flags/custom_operators");

const varNode = (key) => ({ var: key });

const semverRule = (key, sym, target) => ({
  semver_compare: [varNode(key), sym, target],
});

const datetimeRule = (key, sym, target) => ({
  datetime_compare: [varNode(key), sym, target],
});

const customBetween = (op, key, lo, hi) => ({
  and: [
    { [op]: [varNode(key), ">=", lo] },
    { [op]: [varNode(key), "<=", hi] },
  ],
});

const datetimeBetween = (key, lo, hi) => ({
  and: [
    { datetime_compare: [varNode(key), ">=", lo] },
    { datetime_compare: [varNode(key), "<=", hi] },
  ],
});

// Epoch-millisecond constants (UTC instants) used as datetime targets, matching the UI format.
const JUL16_MS = 1_784_160_000_000; // 2026-07-16T00:00:00Z
const JAN1_MS = 1_767_225_600_000; // 2026-01-01T00:00:00Z
const DEC31_MS = 1_798_675_200_000; // 2026-12-31T00:00:00Z
const JUL16_END_MS = 1_784_246_399_999; // 2026-07-16T23:59:59.999Z
const LEAP_DAY_MS = 1_709_164_800_000; // 2024-02-29T00:00:00Z
const JUL16_INDIA_MS = 1_784_140_200_000; // 2026-07-16T00:00:00+05:30
const JUL16_PACIFIC_MS = 1_784_188_800_000; // 2026-07-16T00:00:00-08:00

describe("semver_compare operator", () => {
  it.each([
    ["is, equal", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3" }, true],
    ["is, not equal", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.4" }, false],
    ["is not", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.4" }, true],
    ["less than, patch", semverRule("app_version", "<", "1.2.3"), { app_version: "1.2.2" }, true],
    ["less than, false", semverRule("app_version", "<", "1.2.3"), { app_version: "1.2.3" }, false],
    ["less or equal, boundary", semverRule("app_version", "<=", "1.2.3"), { app_version: "1.2.3" }, true],
    ["greater than, minor", semverRule("app_version", ">", "1.2.3"), { app_version: "1.3.0" }, true],
    ["greater or equal, boundary", semverRule("app_version", ">=", "1.2.3"), { app_version: "1.2.3" }, true],
    ["double-digit ordering (not lexical)", semverRule("app_version", ">", "1.9.0"), { app_version: "1.10.0" }, true],
    ["prerelease precedes release", semverRule("app_version", "<", "1.0.0"), { app_version: "1.0.0-alpha" }, true],
    ["lenient v-prefix", semverRule("app_version", "=", "1.2.3"), { app_version: "v1.2.3" }, true],
    ["lenient uppercase V-prefix", semverRule("app_version", "=", "1.2.3"), { app_version: "V1.2.3" }, true],
    ["v-prefix keeps prerelease", semverRule("app_version", "<", "1.0.0"), { app_version: "v1.0.0-alpha" }, true],
    ["v-prefix, not equal", semverRule("app_version", "!=", "1.2.3"), { app_version: "v1.2.4" }, true],
    ["v-prefix, at or below", semverRule("app_version", "<=", "1.2.3"), { app_version: "v1.2.3" }, true],
    ["v-prefix, greater", semverRule("app_version", ">", "1.2.3"), { app_version: "v1.2.4" }, true],
    ["v-prefix, at or above", semverRule("app_version", ">=", "1.2.3"), { app_version: "v1.2.3" }, true],
    ["lenient minor-only target", semverRule("app_version", "=", "1.2"), { app_version: "1.2.0" }, true],
    // Every symbol is asserted in both directions.
    ["is not, equal", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.3" }, false],
    ["less or equal, above", semverRule("app_version", "<=", "1.2.3"), { app_version: "1.2.4" }, false],
    ["greater than, below", semverRule("app_version", ">", "1.2.3"), { app_version: "1.2.2" }, false],
    ["greater or equal, below", semverRule("app_version", ">=", "1.2.3"), { app_version: "1.2.2" }, false],
    // Prerelease precedence, SemVer 2.0.0 section 11.
    ["prerelease alpha before beta", semverRule("app_version", "<", "1.0.0-beta"), { app_version: "1.0.0-alpha" }, true],
    ["prerelease beta before rc1", semverRule("app_version", "<", "1.0.0-rc1"), { app_version: "1.0.0-beta" }, true],
    ["prerelease rc1 before rc2", semverRule("app_version", "<", "1.0.0-rc2"), { app_version: "1.0.0-rc1" }, true],
    ["more prerelease fields wins", semverRule("app_version", "<", "1.0.0-alpha.1"), { app_version: "1.0.0-alpha" }, true],
    ["numeric identifier below alphanumeric", semverRule("app_version", "<", "1.0.0-alpha.beta"), { app_version: "1.0.0-alpha.1" }, true],
    ["fewer fields below alphanumeric", semverRule("app_version", "<", "1.0.0-alpha.beta"), { app_version: "1.0.0-alpha" }, true],
    ["numeric identifiers compare numerically", semverRule("app_version", "<", "1.0.0-beta.11"), { app_version: "1.0.0-beta.2" }, true],
    ["dotted identifier ordering, letters", semverRule("app_version", "<", "1.0.0-b.1"), { app_version: "1.0.0-a.1" }, true],
    ["dotted identifier ordering, digits", semverRule("app_version", "<", "1.0.0-a.2"), { app_version: "1.0.0-a.1" }, true],
    ["identical prereleases are equal", semverRule("app_version", "=", "1.0.0-rc1"), { app_version: "1.0.0-rc1" }, true],
    ["rc1 outranks dotted rc.1", semverRule("app_version", ">", "1.0.0-rc.1"), { app_version: "1.0.0-rc1" }, true],
    ["core version dominates prerelease", semverRule("app_version", ">", "1.9.9"), { app_version: "2.0.0-alpha" }, true],
    // A release outranks its own prerelease, asserted from both sides and under every symbol.
    ["release outranks its prerelease", semverRule("app_version", ">", "1.0.0-alpha"), { app_version: "1.0.0" }, true],
    ["release at or above its prerelease", semverRule("app_version", ">=", "1.0.0-rc1"), { app_version: "1.0.0" }, true],
    ["release differs from its prerelease", semverRule("app_version", "!=", "1.0.0-alpha"), { app_version: "1.0.0" }, true],
    ["prerelease differs from its release", semverRule("app_version", "!=", "1.0.0"), { app_version: "1.0.0-alpha" }, true],
    ["prerelease at or below its release", semverRule("app_version", "<=", "1.0.0"), { app_version: "1.0.0-alpha" }, true],
    ["prerelease of a higher core still wins", semverRule("app_version", ">", "0.9.9"), { app_version: "1.0.0-alpha" }, true],
    ["prerelease below the next patch", semverRule("app_version", "<", "1.0.1"), { app_version: "1.0.0-rc1" }, true],
    // Prerelease identifier comparison, SemVer 2.0.0 section 11.4.
    ["numeric identifiers are not compared lexically", semverRule("app_version", "<", "1.0.0-10"), { app_version: "1.0.0-2" }, true],
    ["numeric identifier ranks below alphanumeric", semverRule("app_version", "<", "1.0.0-alpha"), { app_version: "1.0.0-1" }, true],
    ["hyphen inside an identifier sorts by ascii", semverRule("app_version", "<", "1.0.0-alpha-1"), { app_version: "1.0.0-alpha" }, true],
    ["beta ranks below rc", semverRule("app_version", "<", "1.0.0-rc.1"), { app_version: "1.0.0-beta.11" }, true],
    ["last prerelease ranks below the release", semverRule("app_version", "<", "1.0.0"), { app_version: "1.0.0-rc.1" }, true],
    // Build metadata carries no precedence.
    ["build metadata ignored", semverRule("app_version", "=", "1.0.0+build2"), { app_version: "1.0.0+build1" }, true],
    ["build metadata ignored with prerelease", semverRule("app_version", "=", "1.0.0-alpha"), { app_version: "1.0.0-alpha+build" }, true],
    ["build metadata with hyphen ignored", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3+build.1-2" }, true],
    // Ignored means equal, so every symbol has to agree with that.
    ["build metadata leaves versions equal", semverRule("app_version", "!=", "1.0.0+build2"), { app_version: "1.0.0+build1" }, false],
    ["build metadata is not less", semverRule("app_version", "<", "1.0.0+build2"), { app_version: "1.0.0+build1" }, false],
    ["build metadata is not greater", semverRule("app_version", ">", "1.0.0+build2"), { app_version: "1.0.0+build1" }, false],
    ["build metadata at or below", semverRule("app_version", "<=", "1.0.0+build2"), { app_version: "1.0.0+build1" }, true],
    ["build metadata at or above", semverRule("app_version", ">=", "1.0.0+build2"), { app_version: "1.0.0+build1" }, true],
    ["build metadata does not block ordering", semverRule("app_version", "<", "1.0.1+build1"), { app_version: "1.0.0+build9" }, true],
    ["build metadata does not block reverse ordering", semverRule("app_version", ">", "1.0.0+build9"), { app_version: "1.0.1+build1" }, true],
    // Partial versions keep their prerelease once zero-padded.
    ["partial version with prerelease", semverRule("app_version", "=", "1.2.0-alpha"), { app_version: "1.2-alpha" }, true],
    ["partial prerelease below later minor", semverRule("app_version", "<", "1.3.1"), { app_version: "1.2-alpha" }, true],
    ["partial prerelease below its release", semverRule("app_version", "<", "1.2.0"), { app_version: "1.2-alpha" }, true],
    ["major-only with prerelease", semverRule("app_version", "<", "1.0.0"), { app_version: "1-rc1" }, true],
    // An empty prerelease is invalid, so it is rejected rather than treated as the bare release.
    ["empty prerelease, no match", semverRule("app_version", "=", "1.0.0"), { app_version: "1.0.0-" }, false],
    ["empty prerelease, not-equal also false", semverRule("app_version", "!=", "1.0.0"), { app_version: "1.0.0-" }, false],
    ["empty prerelease on partial version, no match", semverRule("app_version", "=", "1.2.0"), { app_version: "1.2-" }, false],
    ["empty prerelease on partial version, not-equal also false", semverRule("app_version", "!=", "1.2.0"), { app_version: "1.2-" }, false],
    // Hyphens are legal inside a prerelease identifier, so these are NOT empty prereleases.
    ["trailing hyphen inside identifier", semverRule("app_version", "<", "1.0.0"), { app_version: "1.0.0-alpha-" }, true],
    // SemVer 2.0.0 forbids leading zeros in the core, so these are rejected rather than normalized.
    ["leading zero in major, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "01.2.3" }, false],
    ["leading zero in major, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "01.2.3" }, false],
    ["leading zero in minor, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.02.3" }, false],
    ["leading zero in minor, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.02.3" }, false],
    ["leading zero in patch, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.03" }, false],
    ["leading zero in patch, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.03" }, false],
    ["leading zeros throughout, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "01.02.03" }, false],
    ["leading zeros throughout, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "01.02.03" }, false],
    // A numeric prerelease identifier may not carry a leading zero either (section 9).
    ["numeric prerelease with leading zero, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3-01" }, false],
    ["numeric prerelease with leading zero, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.3-01" }, false],
    ["dotted numeric prerelease with leading zero, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3-rc.01" }, false],
    ["dotted numeric prerelease with leading zero, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.3-rc.01" }, false],
    // An alphanumeric identifier may contain digits, so this one stays valid.
    ["alphanumeric prerelease with digits", semverRule("app_version", "<", "1.2.3"), { app_version: "1.2.3-rc01" }, true],
    ["between, inside", customBetween("semver_compare", "app_version", "1.2.3", "2.0.0"), { app_version: "1.5.0" }, true],
    ["between, low boundary inclusive", customBetween("semver_compare", "app_version", "1.2.3", "2.0.0"), { app_version: "1.2.3" }, true],
    ["between, high boundary inclusive", customBetween("semver_compare", "app_version", "1.2.3", "2.0.0"), { app_version: "2.0.0" }, true],
    ["between, below", customBetween("semver_compare", "app_version", "1.2.3", "2.0.0"), { app_version: "1.0.0" }, false],
    ["between, above", customBetween("semver_compare", "app_version", "1.2.3", "2.0.0"), { app_version: "2.0.1" }, false],
    // A prerelease sits below its own release, which decides both boundary cases.
    ["between, prerelease inside", customBetween("semver_compare", "app_version", "1.2.3", "2.0.0"), { app_version: "1.5.0-rc1" }, true],
    ["between, prerelease below the high bound", customBetween("semver_compare", "app_version", "1.2.3", "2.0.0"), { app_version: "2.0.0-rc1" }, true],
    ["between, prerelease of the low bound falls out", customBetween("semver_compare", "app_version", "1.2.3", "2.0.0"), { app_version: "1.2.3-rc1" }, false],
    ["between, invalid version", customBetween("semver_compare", "app_version", "1.2.3", "2.0.0"), { app_version: "not-a-version" }, false],
    ["between, single-point range", customBetween("semver_compare", "app_version", "1.2.3", "1.2.3"), { app_version: "1.2.3" }, true],
    // Fail-closed: unparseable or missing values never match.
    ["invalid actual, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "not-a-version" }, false],
    ["non-string actual, no match", semverRule("app_version", "=", "1.2.3"), { app_version: 123 }, false],
    ["missing property, no match", semverRule("app_version", "=", "1.2.3"), {}, false],
    // A malformed version must never be padded or coerced into a real one. Both symbols are
    // asserted so that "accepted at all" is observable rather than masked by a single false.
    ["empty version, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "" }, false],
    ["empty version, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "" }, false],
    ["bare v, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "v" }, false],
    ["bare v, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "v" }, false],
    ["leading separator, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "-1.2.3" }, false],
    ["leading separator, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "-1.2.3" }, false],
    ["trailing dot, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1." }, false],
    ["trailing dot, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1." }, false],
    ["trailing dot after patch, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3." }, false],
    ["trailing dot after patch, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.3." }, false],
    ["empty middle segment, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1..2" }, false],
    ["empty middle segment, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1..2" }, false],
    ["four components, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3.4" }, false],
    ["four components, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.3.4" }, false],
    ["range prefix, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "^1.2.3" }, false],
    ["range prefix, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "^1.2.3" }, false],
    ["version inside text, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "abc1.2.3" }, false],
    ["version inside text, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "abc1.2.3" }, false],
    ["empty build metadata, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3+" }, false],
    ["empty build metadata, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.3+" }, false],
    ["empty prerelease identifier, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3-alpha..1" }, false],
    ["empty prerelease identifier, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.3-alpha..1" }, false],
    ["lone dot prerelease, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3-." }, false],
    ["lone dot prerelease, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.3-." }, false],
    ["underscore in prerelease, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "1.2.3-ALPHA_BETA" }, false],
    ["underscore in prerelease, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "1.2.3-ALPHA_BETA" }, false],
    ["doubled v-prefix, no match", semverRule("app_version", "=", "1.2.3"), { app_version: "vv1.2.3" }, false],
    ["doubled v-prefix, not-equal also false", semverRule("app_version", "!=", "1.2.3"), { app_version: "vv1.2.3" }, false],
    ["missing operand, no match", { semver_compare: [varNode("app_version"), "="] }, { app_version: "1.2.3" }, false],
  ])("%s", (_name, rule, data, want) => {
    expect(apply(rule, data)).toBe(want);
  });
});

describe("datetime_compare operator", () => {
  it.each([
    // Asymmetric contract: subject (runtime var) is a strict RFC3339 string, target is epoch ms.
    ["before, true", datetimeRule("signup", "<", JUL16_MS), { signup: "2026-07-15T00:00:00Z" }, true],
    ["before, false", datetimeRule("signup", "<", JUL16_MS), { signup: "2026-07-16T00:00:00Z" }, false],
    ["on (equal), true", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00Z" }, true],
    ["not on, true", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-17T00:00:00Z" }, true],
    ["since (>=), boundary", datetimeRule("signup", ">=", JUL16_MS), { signup: "2026-07-16T00:00:00Z" }, true],
    ["after (>), true", datetimeRule("signup", ">", JUL16_MS), { signup: "2026-07-17T00:00:00Z" }, true],
    ["after (>), false", datetimeRule("signup", ">", JUL16_MS), { signup: "2026-07-15T00:00:00Z" }, false],
    // Every symbol is asserted in both directions.
    ["at or before, boundary", datetimeRule("signup", "<=", JUL16_MS), { signup: "2026-07-16T00:00:00Z" }, true],
    ["at or before, after", datetimeRule("signup", "<=", JUL16_MS), { signup: "2026-07-17T00:00:00Z" }, false],
    ["on (equal), false", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-17T00:00:00Z" }, false],
    ["not on, equal", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16T00:00:00Z" }, false],
    ["since (>=), before", datetimeRule("signup", ">=", JUL16_MS), { signup: "2026-07-15T00:00:00Z" }, false],
    ["between, inside", datetimeBetween("signup", JAN1_MS, DEC31_MS), { signup: "2026-06-15T00:00:00Z" }, true],
    ["between, low boundary inclusive", datetimeBetween("signup", JAN1_MS, DEC31_MS), { signup: "2026-01-01T00:00:00Z" }, true],
    ["between, high boundary inclusive", datetimeBetween("signup", JAN1_MS, DEC31_MS), { signup: "2026-12-31T00:00:00Z" }, true],
    ["between, before range", datetimeBetween("signup", JAN1_MS, DEC31_MS), { signup: "2025-12-31T00:00:00Z" }, false],
    ["between, after range", datetimeBetween("signup", JAN1_MS, DEC31_MS), { signup: "2027-01-01T00:00:00Z" }, false],
    // A leap day is a real date.
    ["leap day", datetimeRule("signup", "=", LEAP_DAY_MS), { signup: "2024-02-29T00:00:00Z" }, true],
    // Time-zone offsets change the instant.
    ["offset with half-hour minutes", datetimeRule("signup", "=", JUL16_INDIA_MS), { signup: "2026-07-16T00:00:00+05:30" }, true],
    ["rfc3339 subject with offset", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T02:00:00+02:00" }, true],
    ["positive offset precedes utc midnight", datetimeRule("signup", "<", JUL16_MS), { signup: "2026-07-16T00:00:00+05:30" }, true],
    ["negative offset", datetimeRule("signup", "=", JUL16_PACIFIC_MS), { signup: "2026-07-16T00:00:00-08:00" }, true],
    ["negative offset follows utc midnight", datetimeRule("signup", ">", JUL16_MS), { signup: "2026-07-16T00:00:00-08:00" }, true],
    ["zero offset equals Z", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00+00:00" }, true],
    // Sub-second precision is dropped, on both sides. The end-of-day rows are the window the UI
    // emits for a single date, whose upper bound carries .999.
    ["one-digit fraction", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00.5Z" }, true],
    ["three-digit fraction", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00.500Z" }, true],
    ["six-digit fraction", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00.123456Z" }, true],
    ["nine-digit fraction", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00.999999999Z" }, true],
    ["zero fraction", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00.0Z" }, true],
    ["fractional seconds truncated", datetimeRule("signup", ">=", JUL16_MS), { signup: "2026-07-16T00:00:00.500Z" }, true],
    ["end-of-day target drops its .999", datetimeRule("signup", "=", JUL16_END_MS), { signup: "2026-07-16T23:59:59Z" }, true],
    ["end-of-day target is an inclusive bound", datetimeRule("signup", "<=", JUL16_END_MS), { signup: "2026-07-16T23:59:59Z" }, true],
    ["end-of-day, fractional subject too", datetimeRule("signup", "=", JUL16_END_MS), { signup: "2026-07-16T23:59:59.999Z" }, true],
    ["end-of-day inclusive, fractional subject", datetimeRule("signup", "<=", JUL16_END_MS), { signup: "2026-07-16T23:59:59.999Z" }, true],
    // Fractional on both sides: the shape the UI actually round-trips.
    // Trimming and lowercasing.
    ["lowercased subject with fraction", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16t00:00:00.500z" }, true],
    ["lowercased subject with offset", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16t02:00:00+02:00" }, true],
    ["whitespace-padded subject", datetimeRule("signup", "=", JUL16_MS), { signup: " 2026-07-16T00:00:00Z " }, true],
    ["lowercased rfc3339 subject", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16t00:00:00z" }, true],
    // Shape violations, asserted under both = and != so that "accepted at all" is observable.
    // RFC 3339 also permits 24:00:00 as end-of-day. Platforms disagree on it, so no vector
    // asserts it either way.
    ["one-digit month, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-7-16T00:00:00Z" }, false],
    ["one-digit month, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-7-16T00:00:00Z" }, false],
    ["space separator, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16 00:00:00Z" }, false],
    ["space separator, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16 00:00:00Z" }, false],
    ["missing zone, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00" }, false],
    ["missing zone, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16T00:00:00" }, false],
    ["empty fraction, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00.Z" }, false],
    ["empty fraction, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16T00:00:00.Z" }, false],
    ["offset without colon, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00+0200" }, false],
    ["offset without colon, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16T00:00:00+0200" }, false],
    ["short offset, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00+02" }, false],
    ["short offset, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16T00:00:00+02" }, false],
    ["trailing junk, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00Zextra" }, false],
    ["trailing junk, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16T00:00:00Zextra" }, false],
    ["basic format, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "20260716T000000Z" }, false],
    ["basic format, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "20260716T000000Z" }, false],
    ["zone after lowercase z, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00z00:00" }, false],
    ["zone after lowercase z, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16T00:00:00z00:00" }, false],
    ["comma fractional separator, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00,5Z" }, false],
    ["comma fractional separator, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16T00:00:00,5Z" }, false],
    // Fail-closed: subject must be an RFC3339 string, target must be an epoch-ms number.
    ["numeric subject, no match", datetimeRule("signup", "=", JUL16_MS), { signup: JUL16_MS }, false],
    ["negative epoch-ms target resolves to -1s", datetimeRule("signup", "=", -1500), { signup: "1969-12-31T23:59:59Z" }, true],
    ["negative epoch-ms target, not equal", datetimeRule("signup", "!=", -1500), { signup: "1969-12-31T23:59:59Z" }, false],
    ["negative epoch-ms target, at or after", datetimeRule("signup", ">=", -1500), { signup: "1969-12-31T23:59:59Z" }, true],
    ["negative epoch-ms target, before", datetimeRule("signup", "<", -1500), { signup: "1969-12-31T23:59:58Z" }, true],
    ["negative epoch-ms target, after", datetimeRule("signup", ">", -2500), { signup: "1969-12-31T23:59:59Z" }, true],
    ["subject floors, it does not truncate", datetimeRule("signup", "=", -2000), { signup: "1969-12-31T23:59:58.500Z" }, true],
    ["subject floors, not to -1s", datetimeRule("signup", "!=", -1000), { signup: "1969-12-31T23:59:58.500Z" }, true],
    ["target beyond representable range, no match", { datetime_compare: [varNode("signup"), "=", 1e308] }, { signup: "2026-07-16T00:00:00Z" }, false],
    ["target beyond representable range, greater-than also false", { datetime_compare: [varNode("signup"), ">", 1e308] }, { signup: "2026-07-16T00:00:00Z" }, false],
    ["target beyond representable range, less-than also false", { datetime_compare: [varNode("signup"), "<", 1e308] }, { signup: "2026-07-16T00:00:00Z" }, false],
    ["bare date subject, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16" }, false],
    ["bare date subject, not-equal also false", datetimeRule("signup", "!=", JUL16_MS), { signup: "2026-07-16" }, false],
    ["zoneless datetime subject, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "2026-07-16T00:00:00" }, false],
    ["non-datetime string, no match", datetimeRule("signup", "=", JUL16_MS), { signup: "yesterday" }, false],
    ["missing property, no match", datetimeRule("signup", "=", JUL16_MS), {}, false],
    ["missing operand, no match", { datetime_compare: [varNode("signup"), "="] }, { signup: "2026-07-16T00:00:00Z" }, false],
  ])("%s", (_name, rule, data, want) => {
    expect(apply(rule, data)).toBe(want);
  });
});
