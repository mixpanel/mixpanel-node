const Mixpanel = require("../lib/mixpanel-node");

describe("logger", () => {
  describe("console logger", () => {
    let mixpanel;
    let consoleDebugFn;
    beforeAll(() => {
      consoleDebugFn = vi.spyOn(console, "debug").mockImplementation(() => {});

      mixpanel = Mixpanel.init("test token");
      mixpanel.send_request = () => {};
      return () => {
        consoleDebugFn.mockRestore();
      };
    });

    it("defaults to console logger", () => {
      const loggerName = Object.prototype.toString.call(mixpanel.config.logger);
      expect(loggerName).toBe("[object console]");
    });

    it("throws an error on incorrect logger object", () => {
      expect(() => mixpanel.set_config({ logger: false })).toThrow(
        new TypeError('"logger" must be a valid Logger object'),
      );
      expect(() => mixpanel.set_config({ logger: { log: () => {} } })).toThrow(
        new TypeError('Logger object missing "trace" method'),
      );
    });

    it("writes log for track() method", () => {
      mixpanel.set_config({ debug: true });

      mixpanel.track("test", { foo: "bar" });

      expect(consoleDebugFn).toHaveBeenCalledTimes(1);

      const [message] = consoleDebugFn.mock.calls[0];

      expect(message).toMatch(/Sending the following event/);
    });

    it("writes log for increment() method", () => {
      mixpanel.set_config({ debug: true });

      mixpanel.people.increment("bob", "page_views", 1);

      expect(consoleDebugFn).toHaveBeenCalledTimes(2);

      const [message] = consoleDebugFn.mock.calls[1];

      expect(message).toMatch(/Sending the following data/);
    });

    it("writes log for remove() method", () => {
      mixpanel.set_config({ debug: true });

      mixpanel.people.remove("bob", { browsers: "firefox" });

      expect(consoleDebugFn).toHaveBeenCalledTimes(3);

      const [message] = consoleDebugFn.mock.calls[2];

      expect(message).toMatch(/Sending the following data/);
    });
  });

  describe("custom logger", () => {
    let mixpanel;
    let customLogger;
    let consoleDebugFn;
    beforeAll(() => {
      /**
       * Custom logger must be an object with the following methods:
       *
       * interface CustomLogger {
       *     trace(message?: any, ...optionalParams: any[]): void;
       *     debug(message?: any, ...optionalParams: any[]): void;
       *     info(message?: any, ...optionalParams: any[]): void;
       *     warn(message?: any, ...optionalParams: any[]): void;
       *     error(message?: any, ...optionalParams: any[]): void;
       * }
       */
      customLogger = {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      consoleDebugFn = vi.spyOn(console, "debug");

      mixpanel = Mixpanel.init("test token", { logger: customLogger });

      mixpanel.send_request = () => {};

      return () => {
        consoleDebugFn.mockRestore();
      };
    });

    it("writes log for track() method", () => {
      mixpanel.set_config({ debug: true });

      mixpanel.track("test", { foo: "bar" });

      expect(customLogger.debug).toHaveBeenCalledTimes(1);
      expect(consoleDebugFn).toHaveBeenCalledTimes(0);

      const [message] = customLogger.debug.mock.calls[0];

      expect(message).toMatch(/Sending the following event/);
    });

    it("writes log for increment() method", () => {
      mixpanel.set_config({ debug: true });

      mixpanel.people.increment("bob", "page_views", 1);

      expect(customLogger.debug).toHaveBeenCalledTimes(2);
      expect(consoleDebugFn).toHaveBeenCalledTimes(0);

      const [message] = customLogger.debug.mock.calls[1];

      expect(message).toMatch(/Sending the following data/);
    });

    it("writes log for remove() method", () => {
      mixpanel.set_config({ debug: true });

      mixpanel.people.remove("bob", { browsers: "firefox" });
      expect(customLogger.debug).toHaveBeenCalledTimes(3);
      expect(consoleDebugFn).toHaveBeenCalledTimes(0);

      const [message] = customLogger.debug.mock.calls[2];

      expect(message).toMatch(/Sending the following data/);
    });
  });
});
