const { ErrorCode } = require("@openfeature/server-sdk");
const { MixpanelProvider } = require("../src/MixpanelProvider");

const FALLBACK_VARIANT = Symbol("fallback");

function createMockFlagsProvider({ flags = new Map(), ready = true } = {}) {
  return {
    getVariant: vi.fn((flagKey, fallbackVariant, _context, _reportExposure) => {
      const variant = flags.get(flagKey);
      if (!variant) {
        return fallbackVariant;
      }
      return variant;
    }),
    _ready: ready,
  };
}

function createMockContext() {
  return { distinct_id: "user-123", plan: "premium" };
}

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("MixpanelProvider", () => {
  let mockFlags;
  let mockFlagsProvider;

  beforeEach(() => {
    mockFlags = new Map();
    mockFlagsProvider = createMockFlagsProvider({ flags: mockFlags });
  });

  describe("metadata", () => {
    it("should have correct provider name", () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      expect(provider.metadata.name).toBe("mixpanel-provider");
    });
  });

  describe("constructor", () => {
    it("should throw when flagsProvider is null", () => {
      expect(() => new MixpanelProvider(null)).toThrow();
    });

    it("should throw when flagsProvider is undefined", () => {
      expect(() => new MixpanelProvider(undefined)).toThrow();
    });

    it("should throw when flagsProvider is missing getVariant", () => {
      expect(() => new MixpanelProvider({})).toThrow("missing required method");
    });
  });

  describe("initialize", () => {
    it("should store context for later evaluations", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      const context = { distinct_id: "user-1", plan: "premium" };

      await provider.initialize(context);

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      await provider.resolveBooleanEvaluation("flag", false, {}, mockLogger);

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        context,
        true,
      );
    });

    it("should use empty context when none provided", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);

      await provider.initialize();

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      await provider.resolveBooleanEvaluation("flag", false, {}, mockLogger);

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        {},
        true,
      );
    });
  });

  describe("onClose", () => {
    it("should resolve without error", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await expect(provider.onClose()).resolves.toBeUndefined();
    });

    it("should call shutdown on the underlying provider if available", async () => {
      const shutdownMock = vi.fn();
      const flagsProviderWithShutdown = {
        ...mockFlagsProvider,
        shutdown: shutdownMock,
      };
      const provider = new MixpanelProvider(flagsProviderWithShutdown);
      await provider.onClose();
      expect(shutdownMock).toHaveBeenCalledOnce();
    });

    it("should not throw if underlying provider has no shutdown method", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await expect(provider.onClose()).resolves.toBeUndefined();
    });
  });

  describe("areFlagsReady", () => {
    it("should return PROVIDER_NOT_READY when areFlagsReady returns false", async () => {
      const notReadyProvider = {
        ...mockFlagsProvider,
        areFlagsReady: vi.fn(() => false),
      };
      const provider = new MixpanelProvider(notReadyProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveBooleanEvaluation(
        "any-flag",
        false,
        {},
        mockLogger,
      );

      expect(result.value).toBe(false);
      expect(result.errorCode).toBe(ErrorCode.PROVIDER_NOT_READY);
      expect(result.errorMessage).toContain("not been loaded");
      expect(result.reason).toBe("ERROR");
    });

    it("should proceed normally when areFlagsReady returns true", async () => {
      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });
      const readyProvider = {
        ...mockFlagsProvider,
        areFlagsReady: vi.fn(() => true),
      };
      const provider = new MixpanelProvider(readyProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveBooleanEvaluation(
        "flag",
        false,
        {},
        mockLogger,
      );

      expect(result.value).toBe(true);
      expect(result.errorCode).toBeUndefined();
    });

    it("should proceed normally when provider has no areFlagsReady method", async () => {
      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveBooleanEvaluation(
        "flag",
        false,
        {},
        mockLogger,
      );

      expect(result.value).toBe(true);
      expect(result.errorCode).toBeUndefined();
    });
  });

  describe("resolveBooleanEvaluation", () => {
    it("should return correct value when flag exists with boolean value", async () => {
      mockFlags.set("feature-enabled", {
        variant_key: "enabled",
        variant_value: true,
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveBooleanEvaluation(
        "feature-enabled",
        false,
        {},
        mockLogger,
      );

      expect(result.value).toBe(true);
      expect(result.variant).toBe("enabled");
      expect(result.reason).toBe("STATIC");
      expect(result.errorCode).toBeUndefined();
    });

    it("should return false boolean value correctly", async () => {
      mockFlags.set("feature-disabled", {
        variant_key: "disabled",
        variant_value: false,
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveBooleanEvaluation(
        "feature-disabled",
        true,
        {},
        mockLogger,
      );

      expect(result.value).toBe(false);
      expect(result.variant).toBe("disabled");
    });

    it("should return TYPE_MISMATCH error when value is not boolean", async () => {
      mockFlags.set("string-flag", {
        variant_key: "variant-a",
        variant_value: "not-a-boolean",
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveBooleanEvaluation(
        "string-flag",
        false,
        {},
        mockLogger,
      );

      expect(result.value).toBe(false);
      expect(result.errorCode).toBe(ErrorCode.TYPE_MISMATCH);
      expect(result.errorMessage).toContain("not a boolean");
      expect(result.reason).toBe("ERROR");
    });

    it("should return FLAG_NOT_FOUND error when flag does not exist", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveBooleanEvaluation(
        "non-existent-flag",
        true,
        {},
        mockLogger,
      );

      expect(result.value).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.FLAG_NOT_FOUND);
      expect(result.errorMessage).toContain("not found");
      expect(result.reason).toBe("ERROR");
    });

    it("should return PROVIDER_NOT_READY error when flags not loaded", async () => {
      mockFlagsProvider._ready = false;
      mockFlagsProvider.getVariant = vi.fn(() => {
        throw new Error("Flags not ready");
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      // Don't initialize - provider is not ready
      const result = await provider.resolveBooleanEvaluation(
        "any-flag",
        false,
        {},
        mockLogger,
      );

      expect(result.value).toBe(false);
      expect(result.errorCode).toBe(ErrorCode.PROVIDER_NOT_READY);
      expect(result.reason).toBe("ERROR");
    });
  });

  describe("resolveStringEvaluation", () => {
    it("should return correct value when flag exists with string value", async () => {
      mockFlags.set("theme-flag", {
        variant_key: "dark",
        variant_value: "dark-mode",
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveStringEvaluation(
        "theme-flag",
        "light-mode",
        {},
        mockLogger,
      );

      expect(result.value).toBe("dark-mode");
      expect(result.variant).toBe("dark");
      expect(result.reason).toBe("STATIC");
      expect(result.errorCode).toBeUndefined();
    });

    it("should return empty string value correctly", async () => {
      mockFlags.set("empty-string-flag", {
        variant_key: "empty",
        variant_value: "",
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveStringEvaluation(
        "empty-string-flag",
        "default",
        {},
        mockLogger,
      );

      expect(result.value).toBe("");
      expect(result.variant).toBe("empty");
    });

    it("should return TYPE_MISMATCH error when value is not string", async () => {
      mockFlags.set("bool-flag", {
        variant_key: "variant-a",
        variant_value: true,
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveStringEvaluation(
        "bool-flag",
        "default",
        {},
        mockLogger,
      );

      expect(result.value).toBe("default");
      expect(result.errorCode).toBe(ErrorCode.TYPE_MISMATCH);
      expect(result.errorMessage).toContain("not a string");
      expect(result.reason).toBe("ERROR");
    });

    it("should return FLAG_NOT_FOUND error when flag does not exist", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveStringEvaluation(
        "non-existent-flag",
        "fallback",
        {},
        mockLogger,
      );

      expect(result.value).toBe("fallback");
      expect(result.errorCode).toBe(ErrorCode.FLAG_NOT_FOUND);
    });

    it("should return PROVIDER_NOT_READY error when not initialized", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      // Don't initialize - provider is not ready
      const result = await provider.resolveStringEvaluation(
        "any-flag",
        "default-string",
        {},
        mockLogger,
      );

      expect(result.value).toBe("default-string");
      expect(result.errorCode).toBe(ErrorCode.PROVIDER_NOT_READY);
      expect(result.reason).toBe("ERROR");
    });
  });

  describe("resolveNumberEvaluation", () => {
    it("should return correct value when flag exists with number value", async () => {
      mockFlags.set("percentage-flag", {
        variant_key: "variant-50",
        variant_value: 50,
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveNumberEvaluation(
        "percentage-flag",
        0,
        {},
        mockLogger,
      );

      expect(result.value).toBe(50);
      expect(result.variant).toBe("variant-50");
      expect(result.reason).toBe("STATIC");
      expect(result.errorCode).toBeUndefined();
    });

    it("should return zero value correctly", async () => {
      mockFlags.set("zero-flag", {
        variant_key: "zero",
        variant_value: 0,
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveNumberEvaluation(
        "zero-flag",
        100,
        {},
        mockLogger,
      );

      expect(result.value).toBe(0);
      expect(result.variant).toBe("zero");
    });

    it("should return TYPE_MISMATCH error when value is not number", async () => {
      mockFlags.set("string-flag", {
        variant_key: "variant-a",
        variant_value: "42",
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveNumberEvaluation(
        "string-flag",
        0,
        {},
        mockLogger,
      );

      expect(result.value).toBe(0);
      expect(result.errorCode).toBe(ErrorCode.TYPE_MISMATCH);
      expect(result.errorMessage).toContain("not a number");
      expect(result.reason).toBe("ERROR");
    });

    it("should return FLAG_NOT_FOUND error when flag does not exist", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveNumberEvaluation(
        "non-existent-flag",
        99,
        {},
        mockLogger,
      );

      expect(result.value).toBe(99);
      expect(result.errorCode).toBe(ErrorCode.FLAG_NOT_FOUND);
    });

    it("should return PROVIDER_NOT_READY error when not initialized", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      // Don't initialize - provider is not ready
      const result = await provider.resolveNumberEvaluation(
        "any-flag",
        42,
        {},
        mockLogger,
      );

      expect(result.value).toBe(42);
      expect(result.errorCode).toBe(ErrorCode.PROVIDER_NOT_READY);
      expect(result.reason).toBe("ERROR");
    });

    it("should handle negative and float values", async () => {
      mockFlags.set("float-flag", {
        variant_key: "float",
        variant_value: -3.14,
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveNumberEvaluation(
        "float-flag",
        0,
        {},
        mockLogger,
      );

      expect(result.value).toBe(-3.14);
    });
  });

  describe("resolveObjectEvaluation", () => {
    it("should return correct value when flag exists with object value", async () => {
      const objectValue = { feature: "enabled", level: 2 };
      mockFlags.set("config-flag", {
        variant_key: "variant-full",
        variant_value: objectValue,
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveObjectEvaluation(
        "config-flag",
        {},
        {},
        mockLogger,
      );

      expect(result.value).toEqual(objectValue);
      expect(result.variant).toBe("variant-full");
      expect(result.reason).toBe("STATIC");
      expect(result.errorCode).toBeUndefined();
    });

    it("should return empty object value correctly", async () => {
      mockFlags.set("empty-object-flag", {
        variant_key: "empty",
        variant_value: {},
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveObjectEvaluation(
        "empty-object-flag",
        { default: true },
        {},
        mockLogger,
      );

      expect(result.value).toEqual({});
      expect(result.variant).toBe("empty");
    });

    it("should return TYPE_MISMATCH error when value is not object (string)", async () => {
      mockFlags.set("string-flag", {
        variant_key: "variant-a",
        variant_value: "not-an-object",
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveObjectEvaluation(
        "string-flag",
        {},
        {},
        mockLogger,
      );

      expect(result.value).toEqual({});
      expect(result.errorCode).toBe(ErrorCode.TYPE_MISMATCH);
      expect(result.errorMessage).toContain("not an object");
      expect(result.reason).toBe("ERROR");
    });

    it("should return TYPE_MISMATCH error when value is null", async () => {
      mockFlags.set("null-flag", {
        variant_key: "variant-a",
        variant_value: null,
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveObjectEvaluation(
        "null-flag",
        { default: true },
        {},
        mockLogger,
      );

      expect(result.value).toEqual({ default: true });
      expect(result.errorCode).toBe(ErrorCode.TYPE_MISMATCH);
    });

    it("should return TYPE_MISMATCH error when value is an array", async () => {
      mockFlags.set("array-flag", {
        variant_key: "variant-a",
        variant_value: [1, 2, 3],
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveObjectEvaluation(
        "array-flag",
        [],
        {},
        mockLogger,
      );

      expect(result.value).toEqual([]);
      expect(result.errorCode).toBe(ErrorCode.TYPE_MISMATCH);
    });

    it("should return FLAG_NOT_FOUND error when flag does not exist", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveObjectEvaluation(
        "non-existent-flag",
        { fallback: true },
        {},
        mockLogger,
      );

      expect(result.value).toEqual({ fallback: true });
      expect(result.errorCode).toBe(ErrorCode.FLAG_NOT_FOUND);
    });

    it("should return PROVIDER_NOT_READY error when not initialized", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      // Don't initialize - provider is not ready
      const result = await provider.resolveObjectEvaluation(
        "any-flag",
        { default: true },
        {},
        mockLogger,
      );

      expect(result.value).toEqual({ default: true });
      expect(result.errorCode).toBe(ErrorCode.PROVIDER_NOT_READY);
      expect(result.reason).toBe("ERROR");
    });
  });

  describe("async flags provider (remote)", () => {
    it("should handle async getVariant from remote provider", async () => {
      const asyncProvider = {
        getVariant: vi.fn(async (flagKey) => {
          return {
            variant_key: "async-variant",
            variant_value: "async-value",
          };
        }),
      };

      const provider = new MixpanelProvider(asyncProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveStringEvaluation(
        "async-flag",
        "default",
        {},
        mockLogger,
      );

      expect(result.value).toBe("async-value");
      expect(result.variant).toBe("async-variant");
      expect(result.reason).toBe("STATIC");
    });
  });

  describe("SDK exception handling", () => {
    it("should return default value with error when getVariant throws", async () => {
      const throwingProvider = {
        getVariant: vi.fn(() => {
          throw new Error("SDK internal error");
        }),
      };

      const provider = new MixpanelProvider(throwingProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveBooleanEvaluation(
        "any-flag",
        false,
        {},
        mockLogger,
      );

      expect(result.value).toBe(false);
      expect(result.errorCode).toBe(ErrorCode.GENERAL);
      expect(result.errorMessage).toContain("SDK internal error");
      expect(result.reason).toBe("ERROR");
    });

    it("should return default string value when getVariant throws", async () => {
      const throwingProvider = {
        getVariant: vi.fn(() => {
          throw new Error("Network timeout");
        }),
      };

      const provider = new MixpanelProvider(throwingProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveStringEvaluation(
        "any-flag",
        "fallback",
        {},
        mockLogger,
      );

      expect(result.value).toBe("fallback");
      expect(result.errorCode).toBe(ErrorCode.GENERAL);
      expect(result.errorMessage).toContain("Network timeout");
      expect(result.reason).toBe("ERROR");
    });

    it("should return default number value when getVariant throws", async () => {
      const throwingProvider = {
        getVariant: vi.fn(() => {
          throw new Error("Connection refused");
        }),
      };

      const provider = new MixpanelProvider(throwingProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveNumberEvaluation(
        "any-flag",
        99,
        {},
        mockLogger,
      );

      expect(result.value).toBe(99);
      expect(result.errorCode).toBe(ErrorCode.GENERAL);
      expect(result.errorMessage).toContain("Connection refused");
      expect(result.reason).toBe("ERROR");
    });

    it("should return default object value when getVariant throws", async () => {
      const throwingProvider = {
        getVariant: vi.fn(() => {
          throw new Error("Parse error");
        }),
      };

      const provider = new MixpanelProvider(throwingProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveObjectEvaluation(
        "any-flag",
        { fallback: true },
        {},
        mockLogger,
      );

      expect(result.value).toEqual({ fallback: true });
      expect(result.errorCode).toBe(ErrorCode.GENERAL);
      expect(result.errorMessage).toContain("Parse error");
      expect(result.reason).toBe("ERROR");
    });

    it("should handle async getVariant rejection", async () => {
      const rejectingProvider = {
        getVariant: vi.fn(async () => {
          throw new Error("Async failure");
        }),
      };

      const provider = new MixpanelProvider(rejectingProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveBooleanEvaluation(
        "any-flag",
        true,
        {},
        mockLogger,
      );

      expect(result.value).toBe(true);
      expect(result.errorCode).toBe(ErrorCode.GENERAL);
      expect(result.errorMessage).toContain("Async failure");
      expect(result.reason).toBe("ERROR");
    });
  });

  describe("edge cases", () => {
    it("should not give targetingKey special treatment", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({});

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      const evalContext = { targetingKey: "tk-123", distinct_id: "user-1" };
      await provider.resolveBooleanEvaluation("flag", false, evalContext, mockLogger);

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        evalContext,
        true,
      );
    });

    it("should allow per-evaluation context to override init context", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({ distinct_id: "init-user", plan: "free" });

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      await provider.resolveBooleanEvaluation(
        "flag",
        false,
        { distinct_id: "eval-user" },
        mockLogger,
      );

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        { distinct_id: "eval-user", plan: "free" },
        true,
      );
    });

    it("should merge per-evaluation context additively with init context", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({ distinct_id: "user-1" });

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      await provider.resolveBooleanEvaluation(
        "flag",
        false,
        { plan: "premium" },
        mockLogger,
      );

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        { distinct_id: "user-1", plan: "premium" },
        true,
      );
    });

    it("should use per-evaluation context on string evaluation", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({ distinct_id: "user-1" });

      mockFlags.set("theme", {
        variant_key: "dark",
        variant_value: "dark-mode",
      });

      await provider.resolveStringEvaluation(
        "theme",
        "light-mode",
        { tier: "enterprise" },
        mockLogger,
      );

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "theme",
        expect.anything(),
        { distinct_id: "user-1", tier: "enterprise" },
        true,
      );
    });

    it("should handle variant_key being null", async () => {
      mockFlags.set("null-key-flag", {
        variant_key: null,
        variant_value: "some-value",
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveStringEvaluation(
        "null-key-flag",
        "default",
        {},
        mockLogger,
      );

      expect(result.value).toBe("some-value");
      expect(result.variant).toBeNull();
      expect(result.reason).toBe("STATIC");
    });

    it("should handle special characters in flag key", async () => {
      mockFlags.set("flag-with-special_chars.and/slashes", {
        variant_key: "variant",
        variant_value: "special",
      });

      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize(createMockContext());
      const result = await provider.resolveStringEvaluation(
        "flag-with-special_chars.and/slashes",
        "default",
        {},
        mockLogger,
      );

      expect(result.value).toBe("special");
    });
  });

  describe("context building and value unwrapping", () => {
    it("should pass nested objects in context through to flagsProvider", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({});

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      const evalContext = {
        distinct_id: "user-1",
        settings: { theme: "dark", notifications: { email: true } },
      };
      await provider.resolveBooleanEvaluation("flag", false, evalContext, mockLogger);

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        {
          distinct_id: "user-1",
          settings: { theme: "dark", notifications: { email: true } },
        },
        true,
      );
    });

    it("should pass arrays in context through to flagsProvider", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({});

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      const evalContext = {
        distinct_id: "user-1",
        tags: ["vip", "beta"],
      };
      await provider.resolveBooleanEvaluation("flag", false, evalContext, mockLogger);

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        {
          distinct_id: "user-1",
          tags: ["vip", "beta"],
        },
        true,
      );
    });

    it("should convert Date objects to ISO strings in context", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({});

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      const date = new Date("2025-06-15T12:00:00.000Z");
      const evalContext = {
        distinct_id: "user-1",
        created_at: date,
      };
      await provider.resolveBooleanEvaluation("flag", false, evalContext, mockLogger);

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        {
          distinct_id: "user-1",
          created_at: "2025-06-15T12:00:00.000Z",
        },
        true,
      );
    });

    it("should not strip objects that happen to have a 'value' property", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({});

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      const evalContext = {
        distinct_id: "user-1",
        config: { value: "production", region: "us-east" },
      };
      await provider.resolveBooleanEvaluation("flag", false, evalContext, mockLogger);

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        {
          distinct_id: "user-1",
          config: { value: "production", region: "us-east" },
        },
        true,
      );
    });

    it("should handle null and undefined values in context", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({});

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      const evalContext = {
        distinct_id: "user-1",
        nullable: null,
        missing: undefined,
      };
      await provider.resolveBooleanEvaluation("flag", false, evalContext, mockLogger);

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        expect.objectContaining({
          distinct_id: "user-1",
          nullable: null,
          missing: undefined,
        }),
        true,
      );
    });

    it("should convert Dates nested inside arrays and objects", async () => {
      const provider = new MixpanelProvider(mockFlagsProvider);
      await provider.initialize({});

      mockFlags.set("flag", {
        variant_key: "on",
        variant_value: true,
      });

      const date = new Date("2025-01-01T00:00:00.000Z");
      const evalContext = {
        events: [{ timestamp: date }],
        meta: { updated: date },
      };
      await provider.resolveBooleanEvaluation("flag", false, evalContext, mockLogger);

      expect(mockFlagsProvider.getVariant).toHaveBeenCalledWith(
        "flag",
        expect.anything(),
        {
          events: [{ timestamp: "2025-01-01T00:00:00.000Z" }],
          meta: { updated: "2025-01-01T00:00:00.000Z" },
        },
        true,
      );
    });
  });
});
