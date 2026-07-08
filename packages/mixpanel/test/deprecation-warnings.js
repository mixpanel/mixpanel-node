const Mixpanel = require("../lib/mixpanel-node");

describe("deprecation warnings", () => {
  let warnings;
  let originalEmitWarning;

  beforeEach(() => {
    warnings = [];
    originalEmitWarning = process.emitWarning;
    process.emitWarning = function (message, type, code) {
      warnings.push({ message, type, code });
    };
  });

  afterEach(() => {
    process.emitWarning = originalEmitWarning;
  });

  it("warns when using api_secret", () => {
    Mixpanel.init("token", { secret: "api-secret" });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe("DeprecationWarning");
    expect(warnings[0].code).toBe("MIXPANEL_LEGACY_AUTH_DEPRECATED");
    expect(warnings[0].message).toContain("api_secret is deprecated");
    expect(warnings[0].message).toContain("ServiceAccountCredentials");
  });

  it("warns when using api_key", () => {
    Mixpanel.init("token", { key: "api-key" });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe("DeprecationWarning");
    expect(warnings[0].code).toBe("MIXPANEL_LEGACY_AUTH_DEPRECATED");
    expect(warnings[0].message).toContain("api_key is deprecated");
    expect(warnings[0].message).toContain("ServiceAccountCredentials");
  });

  it("does not warn when using service account credentials", () => {
    const { ServiceAccountCredentials } = Mixpanel;
    const creds = new ServiceAccountCredentials("user", "secret", "123");

    Mixpanel.init("token", { credentials: creds });

    expect(warnings).toHaveLength(0);
  });

  it("does not warn when using no auth", () => {
    Mixpanel.init("token");

    expect(warnings).toHaveLength(0);
  });
});
