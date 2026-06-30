const proxyquire = require("proxyquire"),
  https = require("https"),
  events = require("events"),
  Mixpanel = require("../lib/mixpanel-node");

const mock_now_time = new Date(2016, 1, 1).getTime(),
  six_days_ago_timestamp = mock_now_time - 1000 * 60 * 60 * 24 * 6;

describe("import", () => {
  let mixpanel;
  beforeEach(() => {
    mixpanel = Mixpanel.init("token", { secret: "my api secret" });

    vi.spyOn(mixpanel, "send_request");

    return () => {
      mixpanel.send_request.mockRestore();
    };
  });

  it("calls send_request with correct endpoint and data", () => {
    const event = "test",
      time = six_days_ago_timestamp,
      props = { key1: "val1" },
      expected_endpoint = "/import",
      expected_data = {
        event: "test",
        properties: expect.objectContaining({
          key1: "val1",
          token: "token",
          time: time,
        }),
      };

    mixpanel.import(event, time, props);

    expect(mixpanel.send_request).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expected_endpoint,
        data: expected_data,
      }),
      undefined,
    );
  });

  it("supports a Date instance greater than 5 days old", () => {
    const event = "test",
      time = new Date(six_days_ago_timestamp),
      props = { key1: "val1" },
      expected_endpoint = "/import",
      expected_data = {
        event: "test",
        properties: expect.objectContaining({
          key1: "val1",
          token: "token",
          time: six_days_ago_timestamp,
        }),
      };

    mixpanel.import(event, time, props);

    expect(mixpanel.send_request).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expected_endpoint,
        data: expected_data,
      }),
      undefined,
    );
  });

  it("supports a Date instance less than 5 days old", () => {
    const event = "test",
      time = new Date(mock_now_time),
      props = { key1: "val1" },
      expected_endpoint = "/import",
      expected_data = {
        event: "test",
        properties: expect.objectContaining({
          key1: "val1",
          token: "token",
          time: mock_now_time,
        }),
      };

    mixpanel.import(event, time, props);

    expect(mixpanel.send_request).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expected_endpoint,
        data: expected_data,
      }),
      undefined,
    );
  });

  it("supports a unix timestamp", () => {
    const event = "test",
      time = mock_now_time,
      props = { key1: "val1" },
      expected_endpoint = "/import",
      expected_data = {
        event: "test",
        properties: expect.objectContaining({
          key1: "val1",
          token: "token",
          time: time,
        }),
      };

    mixpanel.import(event, time, props);
    expect(mixpanel.send_request).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expected_endpoint,
        data: expected_data,
      }),
      undefined,
    );
  });

  it("requires the time argument to be a number or Date", () => {
    expect(() => mixpanel.import("test", new Date())).not.toThrowError();
    expect(() => mixpanel.import("test", Date.now())).not.toThrowError();
    expect(() => mixpanel.import("test", "not a number or Date")).toThrowError(
      /`time` property must be a Date or Unix timestamp/,
    );
    expect(() => mixpanel.import("test")).toThrowError(
      /`time` property must be a Date or Unix timestamp/,
    );
  });
});

describe("import_batch", () => {
  let mixpanel;
  beforeEach(() => {
    mixpanel = Mixpanel.init("token", { secret: "my api secret" });

    vi.spyOn(mixpanel, "send_request");

    return () => {
      mixpanel.send_request.mockRestore();
    };
  });

  it("calls send_request with correct endpoint, data, and method", () => {
    const expected_endpoint = "/import",
      event_list = [
        { event: "test", properties: { key1: "val1", time: 500 } },
        { event: "test", properties: { key2: "val2", time: 1000 } },
        { event: "test2", properties: { key2: "val2", time: 1500 } },
      ],
      expected_data = [
        {
          event: "test",
          properties: { key1: "val1", time: 500, token: "token" },
        },
        {
          event: "test",
          properties: { key2: "val2", time: 1000, token: "token" },
        },
        {
          event: "test2",
          properties: { key2: "val2", time: 1500, token: "token" },
        },
      ];

    mixpanel.import_batch(event_list);

    expect(mixpanel.send_request).toHaveBeenCalledWith(
      {
        method: "POST",
        endpoint: expected_endpoint,
        data: expected_data,
      },
      expect.any(Function),
    );
  });

  it("requires the time argument for every event", () => {
    const event_list = [
      { event: "test", properties: { key1: "val1", time: 500 } },
      { event: "test", properties: { key2: "val2", time: 1000 } },
      { event: "test2", properties: { key2: "val2" } },
    ];
    expect(() => mixpanel.import_batch(event_list)).toThrowError(
      "`time` property must be a Date or Unix timestamp and is only required for `import` endpoint",
    );
  });

  it("batches 50 events at a time", () => {
    const event_list = [];
    for (let ei = 0; ei < 130; ei++) {
      // 3 batches: 50 + 50 + 30
      event_list.push({
        event: "test",
        properties: { key1: "val1", time: 500 + ei },
      });
    }

    mixpanel.import_batch(event_list);
    expect(mixpanel.send_request).toHaveBeenCalledTimes(3);
  });
});

describe("import_batch_integration", () => {
  let mixpanel;
  let _http_emitter;
  let event_list;
  let res;
  beforeEach(() => {
    mixpanel = Mixpanel.init("token", { secret: "my api secret" });

    vi.spyOn(https, "request");

    _http_emitter = new events.EventEmitter();

    // stub sequence of https responses
    res = [];
    for (let ri = 0; ri < 5; ri++) {
      res.push(new events.EventEmitter());
      https.request.mockImplementationOnce((_, cb) => {
        cb(res[ri]);
        return {
          write: () => {},
          end: () => {},
          on: () => {},
        };
      });
    }

    event_list = [];
    for (let ei = 0; ei < 130; ei++) {
      // 3 batches: 50 + 50 + 30
      event_list.push({
        event: "test",
        properties: { key1: "val1", time: 500 + ei },
      });
    }

    return () => {
      https.request.mockRestore();
    };
  });

  it("calls provided callback after all requests finish", () => {
    mixpanel.import_batch(event_list, function (error_list) {
      expect(https.request).toHaveBeenCalledTimes(3);
      expect(error_list).toBe(null);
    });
    for (let ri = 0; ri < 3; ri++) {
      res[ri].emit("data", "1");
      res[ri].emit("end");
    }
  });

  it("passes error list to callback", () => {
    mixpanel.import_batch(event_list, function (error_list) {
      expect(error_list.length).toBe(3);
    });
    for (let ri = 0; ri < 3; ri++) {
      res[ri].emit("data", "0");
      res[ri].emit("end");
    }
  });

  it("calls provided callback when options are passed", () => {
    mixpanel.import_batch(
      event_list,
      { max_batch_size: 100 },
      function (error_list) {
        expect(https.request).toHaveBeenCalledTimes(3);
        expect(error_list).toBe(null);
      },
    );
    for (let ri = 0; ri < 3; ri++) {
      res[ri].emit("data", "1");
      res[ri].emit("end");
    }
  });

  it("sends more requests when max_batch_size < 50", () => {
    mixpanel.import_batch(
      event_list,
      { max_batch_size: 30 },
      function (error_list) {
        expect(https.request).toHaveBeenCalledTimes(5); // 30 + 30 + 30 + 30 + 10
        expect(error_list).toBe(null);
      },
    );
    for (let ri = 0; ri < 5; ri++) {
      res[ri].emit("data", "1");
      res[ri].emit("end");
    }
  });

  it("can set max concurrent requests", () => {
    const async_all_stub = vi.fn();
    const PatchedMixpanel = proxyquire("../lib/mixpanel-node", {
      "./utils": { async_all: async_all_stub },
    });
    async_all_stub.mockImplementationOnce((_, __, cb) => cb(null));
    mixpanel = PatchedMixpanel.init("token", { secret: "my api secret" });

    mixpanel.import_batch(
      event_list,
      { max_batch_size: 30, max_concurrent_requests: 2 },
      function (error_list) {
        // should send 5 event batches over 3 request batches:
        // request batch 1: 30 events, 30 events
        // request batch 2: 30 events, 30 events
        // request batch 3: 10 events
        expect(async_all_stub).toHaveBeenCalledTimes(3);
        expect(error_list).toBe(null);
      },
    );
    for (let ri = 0; ri < 5; ri++) {
      res[ri].emit("data", "1");
      res[ri].emit("end");
    }
  });

  it("behaves well without a callback", () => {
    mixpanel.import_batch(event_list);
    expect(https.request).toHaveBeenCalledTimes(3);
    mixpanel.import_batch(event_list, { max_batch_size: 100 });
    expect(https.request).toHaveBeenCalledTimes(5);
  });
});

describe("import with service account credentials", () => {
  const { ServiceAccountCredentials } = Mixpanel;
  let mixpanel;
  let credentials;

  beforeEach(() => {
    credentials = new ServiceAccountCredentials(
      "sa-user",
      "sa-secret",
      "123456",
    );
    mixpanel = Mixpanel.init("token", { credentials });
    vi.spyOn(mixpanel, "send_request");
  });

  afterEach(() => {
    mixpanel.send_request.mockRestore();
  });

  it("validates credentials on construction", () => {
    expect(() => new ServiceAccountCredentials("", "secret", "123")).toThrow(
      TypeError,
    );
    expect(() => new ServiceAccountCredentials("user", "", "123")).toThrow(
      TypeError,
    );
    expect(() => new ServiceAccountCredentials("user", "secret", "")).toThrow(
      TypeError,
    );
    expect(() => new ServiceAccountCredentials("  ", "secret", "123")).toThrow(
      TypeError,
    );
  });

  it("validates credentials types", () => {
    expect(() => new ServiceAccountCredentials(123, "secret", "123")).toThrow(
      TypeError,
    );
    expect(() => new ServiceAccountCredentials("user", 123, "123")).toThrow(
      TypeError,
    );
    expect(() => new ServiceAccountCredentials("user", "secret", 123)).toThrow(
      TypeError,
    );
  });

  it("trims credential values", () => {
    const creds = new ServiceAccountCredentials(
      "  user  ",
      "  secret  ",
      "  123  ",
    );
    expect(creds.username).toBe("user");
    expect(creds.secret).toBe("secret");
    expect(creds.project_id).toBe("123");
  });

  it("calls send_request with correct endpoint and uses credentials", () => {
    const event = "test",
      time = mock_now_time,
      props = { key1: "val1" };

    mixpanel.import(event, time, props);

    expect(mixpanel.send_request).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/import",
        data: expect.objectContaining({
          event: "test",
          properties: expect.objectContaining({
            key1: "val1",
            token: "token",
            time: time,
          }),
        }),
      }),
      undefined,
    );
  });

  it("requires HTTPS with service account credentials", () => {
    const http_mixpanel = Mixpanel.init("token", {
      credentials,
      protocol: "http",
    });

    expect(() => {
      http_mixpanel.import("test", Date.now(), {});
    }).toThrow("Must use HTTPS with service account credentials");
  });

  it("toHttpBasicAuth encodes correctly", () => {
    const encoded = credentials.toHttpBasicAuth();
    const expected = Buffer.from("sa-user:sa-secret").toString("base64");
    expect(encoded).toBe(expected);
  });

  it("toString masks secret", () => {
    const str = credentials.toString();
    expect(str).toContain("sa-user");
    expect(str).toContain("123456");
    expect(str).toContain("***");
    expect(str).not.toContain("sa-secret");
  });

  it("rejects plain objects that look like credentials", () => {
    // Plain object should not be treated as service account credentials
    const plain_object_mixpanel = Mixpanel.init("token", {
      credentials: { username: "user", secret: "secret", project_id: "123" },
    });

    // Should fail because plain object is not ServiceAccountCredentials instance
    expect(() => {
      plain_object_mixpanel.import("test", Date.now(), {});
    }).toThrow(/The \/import endpoint requires authentication/);
  });

  it("does not send auth headers for non-import endpoints", () => {
    const mixpanel_sa = Mixpanel.init("token", { credentials });
    vi.spyOn(mixpanel_sa, "send_request");

    // Track should not use service account credentials
    mixpanel_sa.track("test event", { distinct_id: "user123" });

    const call_args = mixpanel_sa.send_request.mock.calls[0][0];
    expect(call_args.endpoint).not.toBe("/import");
  });
});

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

  it("warns when using api_secret", () => {
    mixpanel = Mixpanel.init("token", {
      secret: "api-secret",
      logger: mockLogger,
    });

    // Warning should be emitted at init time, not during import
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

  it("warns when using api_key", () => {
    mixpanel = Mixpanel.init("token", {
      key: "api-key",
      logger: mockLogger,
    });

    // Warning should be emitted at init time, not during track
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("DEPRECATION WARNING"),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("api_key is deprecated"),
    );

    // Reset mock to verify it doesn't warn again on subsequent requests
    mockLogger.warn.mockClear();
    mixpanel.track("test", { distinct_id: "user" });
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
