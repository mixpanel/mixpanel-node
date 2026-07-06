const Mixpanel = require("../lib/mixpanel-node");

describe("deprecation warnings", () => {
  let mixpanel;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  it("warns once per process when using api_secret (first use)", () => {
    mixpanel = Mixpanel.init("token", {
      secret: "api-secret",
      logger: mockLogger,
    });

    // Warning should be emitted at init time
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("DEPRECATION WARNING"),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("api_secret is deprecated"),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("ServiceAccountCredentials"),
    );

    // Reset mock to verify it doesn't warn again on subsequent requests
    mockLogger.warn.mockClear();
    mixpanel.import("test", Date.now(), { distinct_id: "user" });
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("does not warn again when creating another client with deprecated auth (already warned)", () => {
    // This simulates serverless where multiple clients are created in same process
    // The warning should NOT fire again since we already warned in the first test
    const anotherMixpanel = Mixpanel.init("token", {
      key: "api-key",
      logger: mockLogger,
    });

    // No warning because we already warned once in this process
    expect(mockLogger.warn).not.toHaveBeenCalled();

    anotherMixpanel.track("test", { distinct_id: "user" });
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("does not warn when using service account credentials", () => {
    const { ServiceAccountCredentials } = Mixpanel;
    const creds = new ServiceAccountCredentials("user", "secret", "123");

    mixpanel = Mixpanel.init("token", {
      credentials: creds,
      logger: mockLogger,
    });

    mixpanel.import("test", Date.now(), { distinct_id: "user" });

    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
