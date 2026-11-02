const nock = require("nock");
const LocalFeatureFlagsProvider = require("../../lib/flags/local_flags");
const {
  VariantSource,
  FallbackReason,
} = require("../../lib/flags/variant_source");

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
  return Math.random().toString(36).substring(7) + "x";
}

const USER_ID = "user123";
const FALLBACK_NAME = "fallback";
const FALLBACK = { variant_value: FALLBACK_NAME };

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
async function createFlagAndLoadItIntoSDK(
  {
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
  provider,
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

function assertVariantReturned(result) {
  expect(result.variant_value).not.toBe(FALLBACK_NAME);
  expect(["control", "treatment"]).toContain(result.variant_value);
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

      const result = provider.getVariant(FLAG_KEY, FALLBACK, {});
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return fallback when wrong context key", async () => {
      await createFlagAndLoadItIntoSDK({ context: "user_id" }, provider);

      const result = provider.getVariant(FLAG_KEY, FALLBACK, {
        distinct_id: USER_ID,
      });
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return test user variant when configured", async () => {
      const variants = [
        { key: "control", value: "false", is_control: true, split: 50.0 },
        { key: "treatment", value: "true", is_control: false, split: 50.0 },
      ];
      await createFlagAndLoadItIntoSDK(
        {
          variants: variants,
          testUsers: { test_user: "treatment" },
        },
        provider,
      );

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
      await createFlagAndLoadItIntoSDK(
        {
          variants: variants,
          testUsers: { test_user: "nonexistent_variant" },
        },
        provider,
      );

      const result = provider.getVariant(FLAG_KEY, FALLBACK, {
        distinct_id: "test_user",
      });
      expect(["false", "true"]).toContain(result.variant_value);
    });

    it("should return fallback when rollout percentage zero", async () => {
      await createFlagAndLoadItIntoSDK({ rolloutPercentage: 0.0 }, provider);

      const result = provider.getVariant(FLAG_KEY, FALLBACK, TEST_CONTEXT);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when rollout percentage hundred", async () => {
      await createFlagAndLoadItIntoSDK({ rolloutPercentage: 100.0 }, provider);

      const result = provider.getVariant(FLAG_KEY, FALLBACK, TEST_CONTEXT);
      assertVariantReturned(result);
    });

    it("should return variant when runtime evaluation satisfied", async () => {
      const runtimeEvaluationRule = { "==": [{ var: "plan" }, "Premium"] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        plan: "Premium",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return fallback when runtime evaluation not satisfied", async () => {
      const runtimeEvaluationRule = { "==": [{ var: "plan" }, "Premium"] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        plan: randomString(),
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return fallback when no runtime parameters are provided", async () => {
      const runtimeEvaluationRule = { "==": [{ var: "plan" }, "Premium"] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters(null);

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return fallback when runtime rule is invalid", async () => {
      const runtimeEvaluationRule = { "=oops=": [{ var: "plan" }, "Premium"] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters(null);

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when runtime evaluation parameters case-insensitively satisfied", async () => {
      const runtimeEvaluationRule = { "==": [{ var: "plan" }, "premium"] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        plan: "PREMIUM",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return variant when runtime evaluation parameters case-insensitively satisfied - multi-condition", async () => {
      const runtimeEvaluationRule = {
        and: [
          { "==": [{ var: "plan" }, "prEmium"] },
          { ">=": [{ var: "date" }, "2025-11-24T09:23"] },
        ],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        plan: "PReMIuM",
        date: "2025-11-24t09:23",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return variant when runtime evaluation rule case-insensitively satisfied", async () => {
      const runtimeEvaluationRule = { "==": [{ var: "plan" }, "PREMIUM"] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        plan: "premium",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return variant when runtime parameter key case-insensitively satisfied", async () => {
      const runtimeEvaluationRule = { "==": [{ var: "plan" }, "premium"] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        Plan: "premium", // Capital P instead of lowercase p
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return variant when runtime evaluation with in operator satisfied", async () => {
      const runtimeEvaluationRule = { in: ["Springfield", { var: "url" }] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        url: "https://helloworld.com/Springfield/all-about-it",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return fallback when runtime evaluation with in operator not satisfied", async () => {
      const runtimeEvaluationRule = { in: ["Springfield", { var: "url" }] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        url: "https://helloworld.com/Boston/all-about-it",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when runtime evaluation with in operator for array satisfied", async () => {
      const runtimeEvaluationRule = {
        in: [{ var: "name" }, ["a", "b", "c", "all-from-the-ui"]],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        name: "b",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return fallback when runtime evaluation with in operator for array not satisfied", async () => {
      const runtimeEvaluationRule = {
        in: [{ var: "name" }, ["a", "b", "c", "all-from-the-ui"]],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        name: "d",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return fallback when runtime evaluation with in operator for array not satisfied because only substring match", async () => {
      const runtimeEvaluationRule = {
        in: [{ var: "name" }, ["a", "b", "c", "all-from-the-ui"]],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        name: "all",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return fallback when runtime evaluation with in operator for array not satisfied because only superstring match", async () => {
      const runtimeEvaluationRule = {
        in: [{ var: "name" }, ["a", "b", "c", "all-from-the-ui"]],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        name: "all-from-the-ui-and-more",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when runtime evaluation with AND operator satisfied", async () => {
      const runtimeEvaluationRule = {
        and: [
          { "==": [{ var: "name" }, "Johannes"] },
          { "==": [{ var: "country" }, "Deutschland"] },
        ],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        name: "Johannes",
        country: "Deutschland",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return fallback when runtime evaluation with AND operator not satisfied", async () => {
      const runtimeEvaluationRule = {
        and: [
          { "==": [{ var: "name" }, "Johannes"] },
          { "==": [{ var: "country" }, "Deutschland"] },
        ],
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
      const runtimeEvaluationRule = { ">": [{ var: "queries_ran" }, 25] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        queries_ran: 27,
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return fallback when runtime evaluation with greater than operator not satisfied", async () => {
      const runtimeEvaluationRule = { ">": [{ var: "queries_ran" }, 25] };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        queries_ran: 20,
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when semver_compare runtime rule satisfied", async () => {
      const runtimeEvaluationRule = {
        semver_compare: [{ var: "app_version" }, ">=", "1.2.3"],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        app_version: "1.5.0",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return fallback when semver_compare runtime rule not satisfied", async () => {
      const runtimeEvaluationRule = {
        semver_compare: [{ var: "app_version" }, ">=", "1.2.3"],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        app_version: "1.0.0",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should return variant when datetime_compare runtime rule satisfied", async () => {
      const runtimeEvaluationRule = {
        datetime_compare: [{ var: "signup" }, "<", 1_784_160_000_000],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        signup: "2026-07-15T00:00:00Z",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return fallback when datetime_compare runtime rule not satisfied", async () => {
      const runtimeEvaluationRule = {
        datetime_compare: [{ var: "signup" }, "<", 1_784_160_000_000],
      };
      await createFlagAndLoadItIntoSDK({ runtimeEvaluationRule }, provider);

      const context = userContextWithRuntimeParameters({
        signup: "2026-07-17T00:00:00Z",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should respect legacy runtime evaluation when satisfied", async () => {
      const legacyRuntimeRule = { plan: "premium", region: "US" };
      await createFlagAndLoadItIntoSDK(
        { runtimeEvaluation: legacyRuntimeRule },
        provider,
      );

      const context = userContextWithRuntimeParameters({
        plan: "premium",
        region: "US",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      assertVariantReturned(result);
    });

    it("should return fallback when legacy runtime evaluation not satisfied", async () => {
      const legacyRuntimeRule = { plan: "premium", region: "US" };
      await createFlagAndLoadItIntoSDK({ legacyRuntimeRule }, provider);

      const context = userContextWithRuntimeParameters({
        plan: randomString(),
        region: "US",
      });

      const result = provider.getVariant(FLAG_KEY, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    });

    it("should pick correct variant with hundred percent split", async () => {
      const variants = [
        { key: "A", value: "variant_a", is_control: false, split: 100.0 },
        { key: "B", value: "variant_b", is_control: false, split: 0.0 },
        { key: "C", value: "variant_c", is_control: false, split: 0.0 },
      ];
      await createFlagAndLoadItIntoSDK(
        {
          variants: variants,
          rolloutPercentage: 100.0,
        },
        provider,
      );

      const result = provider.getVariant(FLAG_KEY, FALLBACK, TEST_CONTEXT);
      expect(result.variant_value).toBe("variant_a");
    });

    it("should pick correct variant with half migrated group splits", async () => {
      const variants = [
        { key: "A", value: "variant_a", is_control: false, split: 100.0 },
        { key: "B", value: "variant_b", is_control: false, split: 0.0 },
        { key: "C", value: "variant_c", is_control: false, split: 0.0 },
      ];
      const variantSplits = { A: 0.0, B: 100.0, C: 0.0 };
      await createFlagAndLoadItIntoSDK(
        {
          variants: variants,
          rolloutPercentage: 100.0,
          variantSplits: variantSplits,
        },
        provider,
      );

      const result = provider.getVariant(FLAG_KEY, FALLBACK, TEST_CONTEXT);
      expect(result.variant_value).toBe("variant_b");
    });

    it("should pick correct variant with full migrated group splits", async () => {
      const variants = [
        { key: "A", value: "variant_a", is_control: false },
        { key: "B", value: "variant_b", is_control: false },
        { key: "C", value: "variant_c", is_control: false },
      ];
      const variantSplits = { A: 0.0, B: 0.0, C: 100.0 };
      await createFlagAndLoadItIntoSDK(
        {
          variants: variants,
          rolloutPercentage: 100.0,
          variantSplits: variantSplits,
        },
        provider,
      );

      const result = provider.getVariant(FLAG_KEY, FALLBACK, TEST_CONTEXT);
      expect(result.variant_value).toBe("variant_c");
    });

    it("should pick overridden variant", async () => {
      const variants = [
        { key: "A", value: "variant_a", is_control: false, split: 100.0 },
        { key: "B", value: "variant_b", is_control: false, split: 0.0 },
      ];
      await createFlagAndLoadItIntoSDK(
        {
          variants: variants,
          variantOverride: { key: "B" },
        },
        provider,
      );

      const result = provider.getVariant(
        FLAG_KEY,
        { variant_value: "control" },
        TEST_CONTEXT,
      );
      expect(result.variant_value).toBe("variant_b");
    });

    it("should track exposure when variant selected", async () => {
      await createFlagAndLoadItIntoSDK({}, provider);

      provider.getVariant(FLAG_KEY, FALLBACK, TEST_CONTEXT);
      expect(mockTracker).toHaveBeenCalledTimes(1);
    });

    it("should track exposure with correct properties", async () => {
      await createFlagAndLoadItIntoSDK(
        {
          experimentId: "exp-123",
          isExperimentActive: true,
          testUsers: { qa_user: "treatment" },
        },
        provider,
      );

      provider.getVariant(FLAG_KEY, FALLBACK, { distinct_id: "qa_user" });

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

      provider.getVariant("nonexistent_flag", FALLBACK, TEST_CONTEXT);
      expect(mockTracker).not.toHaveBeenCalled();
    });

    it("should not track exposure without distinct_id", async () => {
      await createFlagAndLoadItIntoSDK({ context: "company" }, provider);

      provider.getVariant(FLAG_KEY, FALLBACK, { company_id: "company123" });
      expect(mockTracker).not.toHaveBeenCalled();
    });

    // SDK-79: every fallback path must be tagged distinctly via
    // variant_source + fallback_reason so the OpenFeature wrapper can map
    // each to the spec-correct error code.
    describe("variant_source / fallback_reason tagging", () => {
      it("tags matched variants as local with no fallback_reason", async () => {
        await createFlagAndLoadItIntoSDK(
          { rolloutPercentage: 100.0 },
          provider,
        );
        const result = provider.getVariant(FLAG_KEY, FALLBACK, TEST_CONTEXT);
        expect(result.variant_source).toBe(VariantSource.LOCAL);
        expect(result.fallback_reason).toBeUndefined();
        expect(result.variant_key).toBeDefined();
      });

      it("tags missing flag as fallback / FLAG_NOT_FOUND", async () => {
        mockFlagDefinitionsResponse([]);
        await provider.startPollingForDefinitions();
        const result = provider.getVariant("missing", FALLBACK, TEST_CONTEXT);
        expect(result.variant_source).toBe(VariantSource.FALLBACK);
        expect(result.fallback_reason.kind).toBe(
          FallbackReason.Kind.FLAG_NOT_FOUND,
        );
        expect(result.fallback_reason.message).toBeNull();
      });

      it("tags missing context as fallback / MISSING_CONTEXT_KEY with the missing key", async () => {
        await createFlagAndLoadItIntoSDK({ context: "distinct_id" }, provider);
        const result = provider.getVariant(FLAG_KEY, FALLBACK, {});
        expect(result.variant_source).toBe(VariantSource.FALLBACK);
        expect(result.fallback_reason.kind).toBe(
          FallbackReason.Kind.MISSING_CONTEXT_KEY,
        );
        expect(result.fallback_reason.message).toBe("distinct_id");
      });

      it("tags no-rollout-match as fallback / NO_ROLLOUT_MATCH", async () => {
        await createFlagAndLoadItIntoSDK({ rolloutPercentage: 0.0 }, provider);
        const result = provider.getVariant(FLAG_KEY, FALLBACK, TEST_CONTEXT);
        expect(result.variant_source).toBe(VariantSource.FALLBACK);
        expect(result.fallback_reason.kind).toBe(
          FallbackReason.Kind.NO_ROLLOUT_MATCH,
        );
      });
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
      await createFlagAndLoadItIntoSDK(
        {
          variants: variants,
          rolloutPercentage: 100.0,
        },
        provider,
      );

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
      await createFlagAndLoadItIntoSDK(
        {
          variants: variants,
          rolloutPercentage: 100.0,
        },
        provider,
      );

      const result = provider.isEnabled(FLAG_KEY, TEST_CONTEXT);

      expect(result).toBe(true);
    });

    it("should return false when variant value is boolean false", async () => {
      const variants = [
        { key: "control", value: false, is_control: true, split: 100.0 },
      ];
      await createFlagAndLoadItIntoSDK(
        {
          variants: variants,
          rolloutPercentage: 100.0,
        },
        provider,
      );

      const result = provider.isEnabled(FLAG_KEY, TEST_CONTEXT);

      expect(result).toBe(false);
    });
  });

  describe("with service account credentials", () => {
    it("should use service account auth when credentials provided", async () => {
      const { ServiceAccountCredentials } = require("../../lib/credentials");
      const credentials = new ServiceAccountCredentials(
        "sa-user",
        "sa-secret",
        "project-123",
      );

      const flagsConfig = { test_flag: "control" };
      mockFlagDefinitionsResponse([
        createTestFlag({ flagKey: "test_flag", variants: flagsConfig }),
      ]);

      const tracker = () => {};
      const logger = { debug: () => {}, info: () => {}, warn: () => {} };

      const provider = new LocalFeatureFlagsProvider(
        "test-token",
        { api_host: "localhost" },
        tracker,
        logger,
        credentials,
      );

      await provider.areFlagsReady();

      // Verify the provider was created with credentials
      expect(provider.credentials).toBe(credentials);

      // Note: The service account credentials (username, secret, project_id)
      // are passed to the FeatureFlagsProvider parent class which uses them
      // to construct the Authorization header (Basic auth with username:secret)
      // and includes project_id as a query parameter when calling the flags endpoint.
      // This behavior is tested in the FeatureFlagsProvider base class tests.
    });
  });

  describe("polling lifecycle", () => {
    it("dedups initial fetch under concurrent startPollingForDefinitions calls", async () => {
      // Mock setInterval so the spy records the call without scheduling a real
      // timer. A real timer would keep the test process alive if an assertion
      // failed before stopPollingForDefinitions() ran.
      const setIntervalSpy = vi
        .spyOn(global, "setInterval")
        .mockImplementation(() => 999);

      const provider = new LocalFeatureFlagsProvider(
        TEST_TOKEN,
        {
          api_host: "localhost",
          enable_polling: true,
          polling_interval_in_seconds: 3600,
        },
        mockTracker,
        mockLogger,
      );

      nock("https://localhost")
        .persist()
        .get("/flags/definitions")
        .query(true)
        .reply(200, { code: 200, flags: [] });

      // Count fetch invocations — the guard should coalesce concurrent
      // starts into a single _fetchFlagDefinitions() call. Asserting on
      // setInterval alone wouldn't catch a regression: JS's single-threaded
      // microtask model makes the !pollingInterval check-then-set atomic
      // even without the guard, so setInterval would be called once
      // regardless.
      const originalFetch = provider._fetchFlagDefinitions.bind(provider);
      const fetchSpy = vi
        .spyOn(provider, "_fetchFlagDefinitions")
        .mockImplementation(() => originalFetch());

      const N = 8;
      const starts = [];
      for (let i = 0; i < N; i++) {
        starts.push(provider.startPollingForDefinitions());
      }
      await Promise.all(starts);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(provider.pollingInterval).not.toBeNull();

      provider.stopPollingForDefinitions();
      fetchSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });

    it("stopPollingForDefinitions clears the cached start so start can re-fetch (enable_polling=false)", async () => {
      const provider = new LocalFeatureFlagsProvider(
        TEST_TOKEN,
        {
          api_host: "localhost",
          enable_polling: false,
        },
        mockTracker,
        mockLogger,
      );

      nock("https://localhost")
        .persist()
        .get("/flags/definitions")
        .query(true)
        .reply(200, { code: 200, flags: [] });

      const originalFetch = provider._fetchFlagDefinitions.bind(provider);
      const fetchSpy = vi
        .spyOn(provider, "_fetchFlagDefinitions")
        .mockImplementation(() => originalFetch());

      await provider.startPollingForDefinitions();
      provider.stopPollingForDefinitions();
      await provider.startPollingForDefinitions();

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      fetchSpy.mockRestore();
    });

    it("failed initial fetch clears the cached start so subsequent start retries", async () => {
      const provider = new LocalFeatureFlagsProvider(
        TEST_TOKEN,
        {
          api_host: "localhost",
          enable_polling: false,
        },
        mockTracker,
        mockLogger,
      );

      // First attempt fails, second succeeds.
      nock("https://localhost")
        .get("/flags/definitions")
        .query(true)
        .reply(500);
      nock("https://localhost")
        .get("/flags/definitions")
        .query(true)
        .reply(200, { code: 200, flags: [] });

      const originalFetch = provider._fetchFlagDefinitions.bind(provider);
      const fetchSpy = vi
        .spyOn(provider, "_fetchFlagDefinitions")
        .mockImplementation(() => originalFetch());

      await provider.startPollingForDefinitions();
      await provider.startPollingForDefinitions();

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      fetchSpy.mockRestore();
    });

    it("keeps polling when a refresh fails", async () => {
      // Capture the interval callback synchronously so we can drive it
      // directly without letting the real timer fire (and keep the test
      // deterministic).
      let intervalCallback = null;
      const setIntervalSpy = vi
        .spyOn(global, "setInterval")
        .mockImplementation((cb) => {
          intervalCallback = cb;
          return 999;
        });
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      const provider = new LocalFeatureFlagsProvider(
        TEST_TOKEN,
        {
          api_host: "localhost",
          enable_polling: true,
          polling_interval_in_seconds: 3600,
        },
        mockTracker,
        mockLogger,
      );

      // Initial fetch succeeds so we get past _doStartPolling and set up
      // the interval; the next fetch (driven by the interval) fails, and
      // the one after that succeeds again.
      nock("https://localhost")
        .get("/flags/definitions")
        .query(true)
        .reply(200, { code: 200, flags: [] });
      nock("https://localhost")
        .get("/flags/definitions")
        .query(true)
        .reply(500);
      nock("https://localhost")
        .get("/flags/definitions")
        .query(true)
        .reply(200, { code: 200, flags: [] });

      await provider.startPollingForDefinitions();
      expect(provider.pollingInterval).not.toBeNull();
      expect(intervalCallback).not.toBeNull();

      // Fire the poller manually and wait for the awaited fetch inside
      // to reject and hit the catch.
      await intervalCallback();

      // The failure is logged but the interval survives, so a later tick
      // can recover from a transient error.
      expect(clearIntervalSpy).not.toHaveBeenCalled();
      expect(provider.pollingInterval).toBe(999);
      expect(provider._startPromise).not.toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error polling for flag definitions"),
      );

      // Next tick succeeds — polling recovered on its own.
      await intervalCallback();
      expect(provider.pollingInterval).toBe(999);

      clearIntervalSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });
  });
});

describe("LocalFeatureFlagsProvider hierarchical groups", () => {
  const FLAG_KEY_HG = "test_flag";
  const HG_TEMPLATE = "$company:{$company_id}|$user:{$user_id}";
  const HG_FLAG = {
    id: "hg-id",
    name: "HG Test",
    key: "hg-test",
    status: "active",
    project_id: 123,
    serving_method: "client",
    context: "distinct_id",
    context_template: HG_TEMPLATE,
    hash_salt: "880dc3e584b4452fb769808ca18dc9a6",
    ruleset: {
      variants: [
        { key: "On", value: true, split: 1 },
        { key: "Off", value: false, split: 0 },
      ],
      rollout: [{ rollout_percentage: 0.5, variant_splits: { Off: 0, On: 1 } }],
      test: { users: {} },
    },
  };

  let mockTracker;
  let mockLogger;
  let provider;

  const makeProvider = (hierarchical_groups) => {
    provider = new LocalFeatureFlagsProvider(
      "test-token",
      { api_host: "localhost", enable_polling: false, hierarchical_groups },
      mockTracker,
      mockLogger,
    );
    return provider;
  };

  const load = async (flags) => {
    mockFlagDefinitionsResponse(flags);
    await provider.startPollingForDefinitions();
  };

  const withTemplate = (overrides = {}) => ({
    ...createTestFlag(overrides),
    context_template: HG_TEMPLATE,
  });

  const hgContext = (userId, companyId) => ({
    $user_id: userId,
    $company_id: companyId,
  });

  beforeEach(() => {
    mockTracker = vi.fn();
    mockLogger = { error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
    makeProvider(true);
  });

  afterEach(() => {
    provider.stopPollingForDefinitions();
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("assigns a templated context exactly as the distinct id it builds", async () => {
    await load([HG_FLAG]);
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const userId = `u${i}`;
      const templated = provider.getVariant(
        "hg-test",
        FALLBACK,
        { $company_id: "acme", $user_id: userId },
        false,
      );
      const direct = provider.getVariant(
        "hg-test",
        FALLBACK,
        { distinct_id: `$company:acme|$user:${userId}` },
        false,
      );
      expect(templated).toEqual(direct);
      seen.add(templated.variant_source);
    }
    // 50% rollout: both in-rollout and fallback outcomes are exercised
    expect(seen).toEqual(
      new Set([VariantSource.LOCAL, VariantSource.FALLBACK]),
    );

    const userOnly = provider.getVariant("hg-test", FALLBACK, {
      $user_id: "u1",
    });
    expect(userOnly.variant_value).toBe(FALLBACK_NAME);
    expect(userOnly.fallback_reason.kind).toBe(
      FallbackReason.Kind.MISSING_CONTEXT_KEY,
    );
  });

  it("hashes the resolved template value", async () => {
    await load([withTemplate()]);
    const hashSpy = vi.spyOn(provider, "_getAssignedRollout");

    const result = provider.getVariant(
      FLAG_KEY_HG,
      FALLBACK,
      hgContext("user-123", "acme"),
    );

    assertVariantReturned(result);
    expect(hashSpy.mock.calls[0][1]).toBe("$company:acme|$user:user-123");
  });

  it("applies the template without hierarchical_groups", async () => {
    makeProvider(false);
    await load([withTemplate()]);

    const result = provider.getVariant(
      FLAG_KEY_HG,
      FALLBACK,
      hgContext("user-123", "acme"),
    );
    assertVariantReturned(result);
  });

  it("needs every placeholder", async () => {
    await load([withTemplate()]);
    for (const context of [
      { $company_id: "acme" },
      { $company_id: "acme", $user_id: "" },
      { $company_id: "acme", $user_id: null },
    ]) {
      const result = provider.getVariant(FLAG_KEY_HG, FALLBACK, context);
      expect(result.variant_value).toBe(FALLBACK_NAME);
    }
  });

  it("uses a sent context value over the template", async () => {
    await load([withTemplate()]);
    const hashSpy = vi.spyOn(provider, "_getAssignedRollout");

    provider.getVariant(FLAG_KEY_HG, FALLBACK, {
      ...hgContext("user-123", "acme"),
      distinct_id: "someone-else",
    });
    expect(hashSpy.mock.calls[0][1]).toBe("someone-else");
  });

  it("cannot evaluate a distinct_id flag from $user_id/$company_id without a template", async () => {
    await load([createTestFlag()]);
    const hashSpy = vi.spyOn(provider, "_getAssignedRollout");

    const result = provider.getVariant(
      FLAG_KEY_HG,
      FALLBACK,
      hgContext("user-123", "acme"),
    );
    expect(result.variant_value).toBe(FALLBACK_NAME);
    expect(hashSpy).not.toHaveBeenCalled();
  });

  it("resolves test user overrides from the template", async () => {
    await load([
      withTemplate({
        variants: [
          { key: "control", value: "control", is_control: true, split: 1.0 },
          { key: "treatment", value: "treatment", is_control: false, split: 0 },
        ],
        testUsers: { "$company:acme|$user:user-123": "treatment" },
      }),
    ]);
    const result = provider.getVariant(
      FLAG_KEY_HG,
      FALLBACK,
      hgContext("user-123", "acme"),
    );
    expect(result.variant_value).toBe("treatment");
    expect(result.is_qa_tester).toBe(true);
  });

  it("matches test user overrides on a distinct id as sent", async () => {
    await load([
      createTestFlag({
        variants: [
          { key: "control", value: "control", is_control: true, split: 1.0 },
          { key: "treatment", value: "treatment", is_control: false, split: 0 },
        ],
        testUsers: { "$company:acme|$user:user-123": "treatment" },
      }),
    ]);
    const result = provider.getVariant(FLAG_KEY_HG, FALLBACK, {
      ...hgContext("user-123", "acme"),
      distinct_id: "$company:acme|$user:user-123",
    });
    expect(result.variant_value).toBe("treatment");
  });

  it("does not use a templated value for test users when the flag is not keyed on distinct_id", async () => {
    await load([
      {
        ...createTestFlag({
          context: "group_key",
          variants: [
            { key: "control", value: "control", is_control: true, split: 1.0 },
            {
              key: "treatment",
              value: "treatment",
              is_control: false,
              split: 0,
            },
          ],
          testUsers: { "$company:acme|$user:user-123": "treatment" },
        }),
        context_template: HG_TEMPLATE,
      },
    ]);
    const result = provider.getVariant(
      FLAG_KEY_HG,
      FALLBACK,
      hgContext("user-123", "acme"),
    );
    expect(result.variant_value).toBe("control");
  });

  it("hashes group and device flags on the raw context value", async () => {
    await load([
      createTestFlag({ flagKey: "dept", context: "department" }),
      createTestFlag({ flagKey: "device", context: "device_id" }),
    ]);
    const hashSpy = vi.spyOn(provider, "_getAssignedRollout");
    const context = {
      ...hgContext("user-123", "acme"),
      department: "finance",
      device_id: "device-abc",
    };

    provider.getVariant("dept", FALLBACK, context);
    provider.getVariant("device", FALLBACK, context);
    expect(hashSpy.mock.calls[0][1]).toBe("finance");
    expect(hashSpy.mock.calls[1][1]).toBe("device-abc");
  });

  describe("definition parsing", () => {
    it("drops a flag with a newer context_template_version", async () => {
      await load([{ ...createTestFlag(), context_template_version: 2 }]);

      const result = provider.getVariant(FLAG_KEY_HG, FALLBACK, {
        distinct_id: "user-123",
      });
      expect(result.fallback_reason.kind).toBe(
        FallbackReason.Kind.FLAG_NOT_FOUND,
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Dropping flag '${FLAG_KEY_HG}': context_template_version 2`,
        ),
      );
    });

    it("keeps a flag with context_template_version 1", async () => {
      await load([{ ...withTemplate(), context_template_version: 1 }]);
      assertVariantReturned(
        provider.getVariant(
          FLAG_KEY_HG,
          FALLBACK,
          hgContext("user-123", "acme"),
        ),
      );
    });

    it.each([
      "$company:no-placeholders",
      "$company:{}",
      "$company:{  }",
      "$company:{$company_id}|$user:{}",
    ])("drops a flag with malformed template %s", async (template) => {
      await load([{ ...createTestFlag(), context_template: template }]);

      const result = provider.getVariant(FLAG_KEY_HG, FALLBACK, {
        distinct_id: "user-123",
      });
      expect(result.fallback_reason.kind).toBe(
        FallbackReason.Kind.FLAG_NOT_FOUND,
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Dropping flag '${FLAG_KEY_HG}'`),
      );
    });

    it("keeps other flags when one is dropped", async () => {
      await load([
        createTestFlag({ flagKey: "good-flag" }),
        { ...createTestFlag(), context_template_version: 99 },
      ]);
      const context = { distinct_id: "user-123" };

      assertVariantReturned(
        provider.getVariant("good-flag", FALLBACK, context),
      );
      expect(
        provider.getVariant(FLAG_KEY_HG, FALLBACK, context).variant_value,
      ).toBe(FALLBACK_NAME);
    });

    it("treats an empty template as none", async () => {
      await load([{ ...createTestFlag(), context_template: "" }]);
      assertVariantReturned(
        provider.getVariant(FLAG_KEY_HG, FALLBACK, { distinct_id: "user-123" }),
      );
    });
  });

  describe("exposure", () => {
    const exposureProperties = () => mockTracker.mock.calls[0][1];

    it("carries $user_id and $company_id without a distinct_id", async () => {
      await load([withTemplate()]);
      provider.getVariant(FLAG_KEY_HG, FALLBACK, hgContext("user-123", "acme"));

      expect(mockTracker).toHaveBeenCalledTimes(1);
      const properties = exposureProperties();
      expect(properties.$user_id).toBe("user-123");
      expect(properties.$company_id).toBe("acme");
      expect("distinct_id" in properties).toBe(false);
    });

    it("carries the distinct id as sent alongside $user_id and $company_id", async () => {
      await load([createTestFlag()]);
      provider.getVariant(FLAG_KEY_HG, FALLBACK, {
        ...hgContext("user-123", "acme"),
        distinct_id: "$company:acme|$user:user-123",
      });

      const properties = exposureProperties();
      expect(properties.distinct_id).toBe("$company:acme|$user:user-123");
      expect(properties.$user_id).toBe("user-123");
      expect(properties.$company_id).toBe("acme");
    });

    it("attributes by $company_id alone", async () => {
      await load([createTestFlag({ context: "department" })]);
      provider.getVariant(FLAG_KEY_HG, FALLBACK, {
        $company_id: "acme",
        department: "finance",
      });

      const properties = exposureProperties();
      expect(properties.$company_id).toBe("acme");
      expect("$user_id" in properties).toBe(false);
      expect("distinct_id" in properties).toBe(false);
    });

    it("drops an exposure without $company_id or distinct_id, naming $company_id", async () => {
      await load([createTestFlag({ context: "department" })]);
      provider.getVariant(FLAG_KEY_HG, FALLBACK, {
        $user_id: "user-123",
        department: "finance",
      });

      expect(mockTracker).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Cannot track exposure event without a $company_id in the context",
      );
    });

    it("is unchanged without hierarchical_groups", async () => {
      makeProvider(false);
      await load([createTestFlag()]);
      const hashSpy = vi.spyOn(provider, "_getAssignedRollout");
      provider.getVariant(FLAG_KEY_HG, FALLBACK, {
        ...hgContext("user-123", "acme"),
        distinct_id: "user-123",
      });

      expect(hashSpy.mock.calls[0][1]).toBe("user-123");
      expect(mockTracker).toHaveBeenCalledWith(
        "$experiment_started",
        {
          distinct_id: "user-123",
          "Experiment name": FLAG_KEY_HG,
          "Variant name": expect.any(String),
          $experiment_type: "feature_flag",
          "Flag evaluation mode": "local",
          $experiment_id: null,
          $is_experiment_active: null,
          $is_qa_tester: false,
        },
        expect.any(Function),
      );
      expect(Object.keys(exposureProperties())[0]).toBe("distinct_id");
    });

    it("keeps the non-HG drop message without hierarchical_groups", async () => {
      makeProvider(false);
      await load([createTestFlag({ context: "department" })]);
      provider.getVariant(FLAG_KEY_HG, FALLBACK, {
        $company_id: "acme",
        department: "finance",
      });

      expect(mockTracker).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Cannot track exposure event without a distinct_id in the context",
      );
    });
  });
});
