const fs = require("fs");
const path = require("path");

const { apply } = require("json-logic-js");
// Requiring the module registers semver_compare and datetime_compare on the shared
// json-logic-js instance used by apply().
require("../../lib/flags/custom_operators");

// The golden vectors are the cross-SDK contract for the custom operators; the canonical copy and
// its README live in the analytics monorepo. Cases run through apply() so that operator
// registration is covered alongside the comparison itself.
const TEST_DATA = path.join(__dirname, "test-data");

// The property key the vectors are evaluated against. It is plumbing the test supplies, so any name
// works as long as the rule and the data agree on it.
const VECTOR_KEY = "value";

// Build the event the rule reads from, omitting the key entirely for an unset property.
function dataFor(subject) {
  return subject === null ? {} : { [VECTOR_KEY]: subject };
}

// Read a golden-vector file. String entries are headings, array entries are cases.
function loadVectors(operator) {
  const entries = JSON.parse(
    fs.readFileSync(
      path.join(TEST_DATA, `${operator}_compare_tests.json`),
      "utf8",
    ),
  );

  let section = "";
  const cases = [];
  entries.forEach((entry, index) => {
    if (typeof entry === "string") {
      section = entry;
      return;
    }
    const [subject, symbol, target, want] = entry;
    const rule = {
      [`${operator}_compare`]: [{ var: VECTOR_KEY }, symbol, target],
    };
    const name = `${index} ${section}: ${JSON.stringify(subject)} ${symbol} ${JSON.stringify(target)}`;
    cases.push([name, rule, dataFor(subject), want]);
  });
  return cases;
}

describe("semver_compare operator", () => {
  it.each(loadVectors("semver"))("%s", (_name, rule, data, want) => {
    expect(apply(rule, data)).toBe(want);
  });
});

describe("datetime_compare operator", () => {
  it.each(loadVectors("datetime"))("%s", (_name, rule, data, want) => {
    expect(apply(rule, data)).toBe(want);
  });
});

// The cases below are not golden vectors. They pin behaviour the shared files cannot express: a
// rule shape the engine would never produce, and the difference between an absent property and one
// holding a null, which both fail closed.
describe("fail-closed guards", () => {
  it("refuses a rule that is missing an operand", () => {
    const rule = { datetime_compare: [{ var: "signup" }, "==="] };
    expect(apply(rule, { signup: "2026-07-16T00:00:00Z" })).toBe(false);
  });

  it("omits the property for an unset subject", () => {
    expect(dataFor(null)).toEqual({});
    expect(dataFor("1.2.3")).toEqual({ [VECTOR_KEY]: "1.2.3" });
  });
});
