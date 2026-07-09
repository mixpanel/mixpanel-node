const Mixpanel = require("../lib/mixpanel-node");

describe("deprecation warnings", () => {
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

  it("warns when using api_secret", () => {
    Mixpanel.init("token", {
      secret: "api-secret",
      logger: mockLogger,
    });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("DEPRECATION WARNING"),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("api_secret is deprecated"),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("ServiceAccountCredentials"),
    );
  });

  it("warns when using api_key", () => {
    Mixpanel.init("token", {
      key: "api-key",
      logger: mockLogger,
    });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("DEPRECATION WARNING"),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("api_key is deprecated"),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("ServiceAccountCredentials"),
    );
  });

  it("does not warn when using service account credentials", () => {
    const { ServiceAccountCredentials } = Mixpanel;
    const creds = new ServiceAccountCredentials("user", "secret", "123");

    Mixpanel.init("token", {
      credentials: creds,
      logger: mockLogger,
    });

    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("does not warn when using no auth", () => {
    Mixpanel.init("token", { logger: mockLogger });

    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
