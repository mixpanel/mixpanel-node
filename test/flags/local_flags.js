const nock = require("nock");
const LocalFeatureFlagsProvider = require("../../lib/flags/local_flags");

const mockFlagDefinitionsResponse = (flags) => {
  const response = {
    code: 200,
    flags: flags,
  };

  nock("https://localhost")
    .get("/flags/definitions")
    .query(true)
    .reply(200, response);
};

const mockFailedFlagDefinitionsResponse = (statusCode) => {
  nock("https://localhost")
    .get("/flags/definitions")
    .query(true)
    .reply(statusCode);
};

function randomString() {
    Math.random().toString(36).substring(7)
}

const USER_ID = "user123";
const FALLBACK_NAME = "fallback";
const FALLBACK = { variant_value: FALLBACK_NAME }

const createTestFlag = ({
  flagKey = "test_flag",
  context = "distinct_id",
  variants = null,
  variantOverride = null,
  rolloutPercentage = 100.0,
  legacyRuntimeRule = null,
  runtimeEvaluationRule = null,
  testUsers = null,
  experimentId = null,
  isExperimentActive = null,
  variantSplits = null,
  hashSalt = null,
} = {}) => {
  const defaultVariants = [
    { key: "control", value: "control", is_control: true, split: 50.0 },
    { key: "treatment", value: "treatment", is_control: false, split: 50.0 },
  ];

  const rollout = [
    {
      rollout_percentage: rolloutPercentage,
      runtime_evaluation_definition: legacyRuntimeRule,
      runtime_evaluation_rule: runtimeEvaluationRule,
      variant_override: variantOverride,
      variant_splits: variantSplits,
    },
  ];

  const testConfig = testUsers ? { users: testUsers } : null;

  return {
    id: "test-id",
    name: "Test Flag",
    key: flagKey,
    status: "active",
    project_id: 123,
    context: context,
    experiment_id: experimentId,
    is_experiment_active: isExperimentActive,
    hash_salt: hashSalt,
    ruleset: {
      variants: variants || defaultVariants,
      rollout: rollout,
      test: testConfig,
    },
  };
};
async function createFlagAndLoadItIntoSDK({
    flagKey = "test_flag",
    context = "distinct_id",
    variants = null,
    variantOverride = null,
    rolloutPercentage = 100.0,
    legacyRuntimeRule = null,
    runtimeEvaluationRule = null,
    testUsers = null,
    experimentId = null,
    isExperimentActive = null,
    variantSplits = null,
    hashSalt = null,
} = {},
    provider
) {
    const flag = createTestFlag({ 
        flagKey,
        context,
        variants,
        variantOverride,
        rolloutPercentage,
        legacyRuntimeRule,
        runtimeEvaluationRule,
        testUsers,
        experimentId,
        isExperimentActive,
        variantSplits,
        hashSalt,
    });
    mockFlagDefinitionsResponse([flag]);
    await provider.startPollingForDefinitions();
}

describe("LocalFeatureFlagsProvider", () => {

  const TEST_TOKEN = "test-token";
  const TEST_CONTEXT = {
    distinct_id: "test-user",
  };
  const FLAG_KEY = "test_flag";

    function userContextWithRuntimeParameters(custom_properties) {
        return {
            ...TEST_CONTEXT,
            custom_properties: custom_properties,
        };
    }

  let mockTracker;
  let mockLogger;

  beforeEach(() => {
    mockTracker = vi.fn();

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("getVariant", () => {
    let provider;

    beforeEach(() => {
      const config = {
        api_host: "localhost",
        enable_polling: false,
      };

      provider = new LocalFeatureFlagsProvider(
        TEST_TOKEN,
        config,
        mockTracker,
        mockLogger,
      );
    });

    afterEach(() => {
      provider.stopPollingForDefinitions();
    });

    it("should return fallback when no flag definitions", async () => {
      mockFlagDefinitionsResponse([]);
      await provider.startPollingForDefinitions();

      const result = provider.getVariant(
        "nonexistent_flag",
        { variant_value: "control" },
        TEST_CONTEXT,
      );
      expect(result.variant_value).toBe("control");
      expect(mockTracker).not.toHaveBeenCalled();
    });

    it("should return fallback if flag definition call fails", async () => {
      mockFailedFlagDefinitionsResponse(500);

      await provider.startPollingForDefinitions();
      const result = provider.getVariant(
        "nonexistent_flag",
        { variant_value: "control" },
        TEST_CONTEXT,
      );
      expect(result.variant_value).toBe("control");
    });

    it("should return fallback when flag does not exist", async () => {
      await createFlagAndLoadItIntoSDK({ flagKey: "other_flag" }, provider);

      const result = provider.getVariant(
        "nonexistent_flag",
        { variant_value: "control" },
        TEST_CONTEXT,
      );
      expect(result.variant_value).toBe("control");
    });

    it("should return fallback when no context", async () => {
      await createFlagAndLoadItIntoSDK({ context: "distinct_id" }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        {},
      );
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return fallback when wrong context key", async () => {
      await createFlagAndLoadItIntoSDK({ context: "user_id" }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        { distinct_id: USER_ID },
      );
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return test user variant when configured", async () => {
      const variants = [
        { key: "control", value: "false", is_control: true, split: 50.0 },
        { key: "treatment", value: "true", is_control: false, split: 50.0 },
      ];
      await createFlagAndLoadItIntoSDK({
        variants: variants,
        testUsers: { test_user: "treatment" },
      }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        { variant_value: "control" },
        { distinct_id: "test_user" },
      );
      expect(result.variant_value).toBe("true");
    });

    it("should return correct variant when test user variant not configured", async () => {
      const variants = [
        { key: "control", value: "false", is_control: true, split: 50.0 },
        { key: "treatment", value: "true", is_control: false, split: 50.0 },
      ];
      await createFlagAndLoadItIntoSDK({
        variants: variants,
        testUsers: { test_user: "nonexistent_variant" },
      }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        { distinct_id: "test_user" },
      );
      expect(["false", "true"]).toContain(result.variant_value);
    });

    it("should return fallback when rollout percentage zero", async () => {
      await createFlagAndLoadItIntoSDK({ rolloutPercentage: 0.0 }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        TEST_CONTEXT,
      );
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when rollout percentage hundred", async () => {
      await createFlagAndLoadItIntoSDK({ rolloutPercentage: 100.0 }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        TEST_CONTEXT,
      );
      expect(result.variant_value).not.toBe(FALLBACK_NAME);
      expect(["control", "treatment"]).toContain(result.variant_value);
    });

    it("should return variant when runtime evaluation satisfied", async () => {
      const runtimeEvaluationRule = { "==": [ { var: "plan" }, "Premium" ] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule}, provider);

      const context = userContextWithRuntimeParameters({
          plan: "Premium",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).not.toBe(FALLBACK_NAME);
    });

    it("should return fallback when runtime evaluation not satisfied", async () => {
      const runtimeEvaluationRule = { "==": [ { var: "plan" }, "Premium" ] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule}, provider);

      const context = userContextWithRuntimeParameters({
          plan: randomString(),
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when runtime evaluation parameters case-insensitively satisfied", async () => {
      const runtimeEvaluationRule = { "==": [ { var: "plan" }, "premium" ] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule}, provider);

      const context = userContextWithRuntimeParameters({
          plan: "PREMIUM",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).not.toBe(FALLBACK_NAME);
    });

    it("should return variant when runtime evaluation rule case-insensitively satisfied", async () => {
      const runtimeEvaluationRule = { "==": [ { var: "plan" }, "PREMIUM" ] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule}, provider);

      const context = userContextWithRuntimeParameters({
          plan: "premium",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).not.toBe(FALLBACK_NAME);
    });

    it("should return variant when runtime evaluation with in operator satisfied", async () => {
      const runtimeEvaluationRule = {"in": ["Springfield", {"var": "url"}]};
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        url: "https://helloworld.com/Springfield/all-about-it",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).not.toBe(FALLBACK_NAME);
    });

    it("should return fallback when runtime evaluation with in operator not satisfied", async () => {
      const runtimeEvaluationRule = {"in": ["Springfield", {"var": "url"}]};
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        url: "https://helloworld.com/Boston/all-about-it",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when runtime evaluation with in operator for array satisfied", async () => {
      const runtimeEvaluationRule = {"in": [{"var": "name"}, ["a", "b", "c", "all-from-the-ui"]]};
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        name: "b",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).not.toBe(FALLBACK_NAME);
    });

    it("should return fallback when runtime evaluation with in operator for array not satisfied", async () => {
      const runtimeEvaluationRule = {"in": [{"var": "name"}, ["a", "b", "c", "all-from-the-ui"]]};
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        name: "d",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when runtime evaluation with and operator satisfied", async () => {
      const runtimeEvaluationRule = {
        "and": [
          {"==": [{"var": "name"}, "Johannes"]},
          {"==": [{"var": "country"}, "Deutschland"]}
        ]
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        name: "Johannes",
        country: "Deutschland",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).not.toBe(FALLBACK_NAME);
    });

    it("should return fallback when runtime evaluation with and operator not satisfied", async () => {
      const runtimeEvaluationRule = {
        "and": [
          {"==": [{"var": "name"}, "Johannes"]},
          {"==": [{"var": "country"}, "Deutschland"]}
        ]
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        name: "Johannes",
        country: "USA",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when runtime evaluation with greater than operator satisfied", async () => {
      const runtimeEvaluationRule = {">": [{"var": "queries_ran"}, 25]};
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        queries_ran: 27,
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).not.toBe(FALLBACK_NAME);
    });

    it("should return fallback when runtime evaluation with greater than operator not satisfied", async () => {
      const runtimeEvaluationRule = {">": [{"var": "queries_ran"}, 25]};
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        queries_ran: 20,
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should respect legacy runtime evaluation when satisfied", async () => {
      const legacyRuntimeRule = { plan: "premium", region: "US" };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluation: legacyRuntimeRule}, provider);

      const context = userContextWithRuntimeParameters({
          plan: "premium",
          region: "US",
      });

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        context,
      );
      expect(result.variant_value).not.toBe(FALLBACK_NAME);
    });

    it("should return fallback when legacy runtime evaluation not satisfied", async () => {
      const legacyRuntimeRule = { plan: "premium", region: "US" };
      await createFlagAndLoadItIntoSDK({ legacyRuntimeRule}, provider);

      const context = userContextWithRuntimeParameters({
          plan: randomString(),
          region: "US",
      });

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        context,
      );
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should pick correct variant with hundred percent split", async () => {
      const variants = [
        { key: "A", value: "variant_a", is_control: false, split: 100.0 },
        { key: "B", value: "variant_b", is_control: false, split: 0.0 },
        { key: "C", value: "variant_c", is_control: false, split: 0.0 },
      ];
      await createFlagAndLoadItIntoSDK({
        variants: variants,
        rolloutPercentage: 100.0,
      }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        TEST_CONTEXT,
      );
      expect(result.variant_value).toBe("variant_a");
    });

    it("should pick correct variant with half migrated group splits", async () => {
      const variants = [
        { key: "A", value: "variant_a", is_control: false, split: 100.0 },
        { key: "B", value: "variant_b", is_control: false, split: 0.0 },
        { key: "C", value: "variant_c", is_control: false, split: 0.0 },
      ];
      const variantSplits = { A: 0.0, B: 100.0, C: 0.0 };
      await createFlagAndLoadItIntoSDK({
        variants: variants,
        rolloutPercentage: 100.0,
        variantSplits: variantSplits,
      }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        TEST_CONTEXT,
      );
      expect(result.variant_value).toBe("variant_b");
    });

    it("should pick correct variant with full migrated group splits", async () => {
      const variants = [
        { key: "A", value: "variant_a", is_control: false },
        { key: "B", value: "variant_b", is_control: false },
        { key: "C", value: "variant_c", is_control: false },
      ];
      const variantSplits = { A: 0.0, B: 0.0, C: 100.0 };
      await createFlagAndLoadItIntoSDK({
        variants: variants,
        rolloutPercentage: 100.0,
        variantSplits: variantSplits,
      }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        TEST_CONTEXT,
      );
      expect(result.variant_value).toBe("variant_c");
    });

    it("should pick overridden variant", async () => {
      const variants = [
        { key: "A", value: "variant_a", is_control: false, split: 100.0 },
        { key: "B", value: "variant_b", is_control: false, split: 0.0 },
      ];
      await createFlagAndLoadItIntoSDK({
        variants: variants,
        variantOverride: { key: "B" },
      }, provider);

      const result = provider.getVariant(
        FLAG_KEY,
        { variant_value: "control" },
        TEST_CONTEXT,
      );
      expect(result.variant_value).toBe("variant_b");
    });

    it("should track exposure when variant selected", async () => {
      await createFlagAndLoadItIntoSDK({}, provider);

      provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        TEST_CONTEXT,
      );
      expect(mockTracker).toHaveBeenCalledTimes(1);
    });

    it("should track exposure with correct properties", async () => {
      await createFlagAndLoadItIntoSDK({
        experimentId: "exp-123",
        isExperimentActive: true,
        testUsers: { qa_user: "treatment" },
      }, provider);

      provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        { distinct_id: "qa_user" },
      );

      expect(mockTracker).toHaveBeenCalledTimes(1);

      const call = mockTracker.mock.calls[0];
      const properties = call[1];

      expect(properties["$experiment_id"]).toBe("exp-123");
      expect(properties["$is_experiment_active"]).toBe(true);
      expect(properties["$is_qa_tester"]).toBe(true);
    });

    it("should not track exposure on fallback", async () => {
      mockFlagDefinitionsResponse([]);
      await provider.startPollingForDefinitions();

      provider.getVariant(
        "nonexistent_flag",
        FALLBACK,
        TEST_CONTEXT,
      );
      expect(mockTracker).not.toHaveBeenCalled();
    });

    it("should not track exposure without distinct_id", async () => {
      await createFlagAndLoadItIntoSDK({ context: "company" }, provider);

      provider.getVariant(
        FLAG_KEY,
        FALLBACK,
        { company_id: "company123" },
      );
      expect(mockTracker).not.toHaveBeenCalled();
    });
  });

  describe("getAllVariants", () => {
    let provider;

    beforeEach(() => {
      const config = {
        api_host: "localhost",
        enable_polling: false,
      };

      provider = new LocalFeatureFlagsProvider(
        TEST_TOKEN,
        config,
        mockTracker,
        mockLogger,
      );
    });

    afterEach(() => {
      provider.stopPollingForDefinitions();
    });

    it("should return empty object when no flag definitions", async () => {
      mockFlagDefinitionsResponse([]);
      await provider.startPollingForDefinitions();

      const result = provider.getAllVariants(TEST_CONTEXT);

      expect(result).toEqual({});
    });

    it("should return all variants when two flags have 100% rollout", async () => {
      const flag1 = createTestFlag({
        flagKey: "flag1",
        rolloutPercentage: 100.0,
      });
      const flag2 = createTestFlag({
        flagKey: "flag2",
        rolloutPercentage: 100.0,
      });

      mockFlagDefinitionsResponse([flag1, flag2]);
      await provider.startPollingForDefinitions();

      const result = provider.getAllVariants(TEST_CONTEXT);

      expect(Object.keys(result).length).toBe(2);
      expect(result).toHaveProperty("flag1");
      expect(result).toHaveProperty("flag2");
    });

    it("should return partial results when one flag has 0% rollout", async () => {
      const flag1 = createTestFlag({
        flagKey: "flag1",
        rolloutPercentage: 100.0,
      });
      const flag2 = createTestFlag({
        flagKey: "flag2",
        rolloutPercentage: 0.0,
      });

      mockFlagDefinitionsResponse([flag1, flag2]);
      await provider.startPollingForDefinitions();

      const result = provider.getAllVariants(TEST_CONTEXT);

      expect(Object.keys(result).length).toBe(1);
      expect(result).toHaveProperty("flag1");
      expect(result).not.toHaveProperty("flag2");
    });
  });

  describe("getVariantValue", () => {
    let provider;

    beforeEach(() => {
      const config = {
        api_host: "localhost",
        enable_polling: false,
      };

      provider = new LocalFeatureFlagsProvider(
        TEST_TOKEN,
        config,
        mockTracker,
        mockLogger,
      );
    });

    afterEach(() => {
      provider.stopPollingForDefinitions();
    });

    it("should return variant value when flag exists", async () => {
      const variants = [
        { key: "treatment", value: "blue", is_control: false, split: 100.0 },
      ];
      await createFlagAndLoadItIntoSDK({
        variants: variants,
        rolloutPercentage: 100.0,
      }, provider);

      const result = provider.getVariantValue(
        FLAG_KEY,
        "default",
        TEST_CONTEXT,
      );

      expect(result).toBe("blue");
    });

    it("should return fallback value when flag doesn't exist", async () => {
      mockFlagDefinitionsResponse([]);
      await provider.startPollingForDefinitions();

      const result = provider.getVariantValue(
        "nonexistent_flag",
        "default_value",
        TEST_CONTEXT,
      );

      expect(result).toBe("default_value");
    });
  });

  describe("isEnabled", () => {
    let provider;

    beforeEach(() => {
      const config = {
        api_host: "localhost",
        enable_polling: false,
      };

      provider = new LocalFeatureFlagsProvider(
        TEST_TOKEN,
        config,
        mockTracker,
        mockLogger,
      );
    });

    afterEach(() => {
      provider.stopPollingForDefinitions();
    });

    it("should return true when variant value is boolean true", async () => {
      const variants = [
        { key: "treatment", value: true, is_control: false, split: 100.0 },
      ];
      await createFlagAndLoadItIntoSDK({
        variants: variants,
        rolloutPercentage: 100.0,
      }, provider);

      const result = provider.isEnabled(FLAG_KEY, TEST_CONTEXT);

      expect(result).toBe(true);
    });

    it("should return false when variant value is boolean false", async () => {
      const variants = [
        { key: "control", value: false, is_control: true, split: 100.0 },
      ];
      await createFlagAndLoadItIntoSDK({
        variants: variants,
        rolloutPercentage: 100.0,
      }, provider);

      const result = provider.isEnabled(FLAG_KEY, TEST_CONTEXT);

      expect(result).toBe(false);
    });
  });
});
