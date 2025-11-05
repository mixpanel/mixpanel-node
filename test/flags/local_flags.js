const nock = require('nock');
const LocalFeatureFlagsProvider = require('../../lib/flags/local_flags');

const mockFlagDefinitionsResponse = (flags) => {
    const response = {
        code: 200,
        flags: flags,
    };

    nock('https://localhost')
        .get('/flags/definitions')
        .query(true)
        .reply(200, response);
};

const mockFailedFlagDefinitionsResponse = (statusCode) => {
    nock('https://localhost')
        .get('/flags/definitions')
        .query(true)
        .reply(statusCode);
};

const createTestFlag = ({
    flagKey = 'test_flag',
    context = 'distinct_id',
    variants = null,
    variantOverride = null,
    rolloutPercentage = 100.0,
    runtimeEvaluation = null,
    testUsers = null,
    experimentId = null,
    isExperimentActive = null,
    variantSplits = null,
    hashSalt = null
} = {}) => {
    const defaultVariants = [
        { key: 'control', value: 'control', is_control: true, split: 50.0 },
        { key: 'treatment', value: 'treatment', is_control: false, split: 50.0 }
    ];

    const rollout = [{
        rollout_percentage: rolloutPercentage,
        runtime_evaluation_definition: runtimeEvaluation,
        variant_override: variantOverride,
        variant_splits: variantSplits
    }];

    const testConfig = testUsers ? { users: testUsers } : null;

    return {
        id: 'test-id',
        name: 'Test Flag',
        key: flagKey,
        status: 'active',
        project_id: 123,
        context: context,
        experiment_id: experimentId,
        is_experiment_active: isExperimentActive,
        hash_salt: hashSalt,
        ruleset: {
            variants: variants || defaultVariants,
            rollout: rollout,
            test: testConfig
        }
    };
};

describe('LocalFeatureFlagsProvider', () => {
    const TEST_TOKEN = 'test-token';
    const TEST_CONTEXT = {
        distinct_id: 'test-user',
    };

    let mockTracker;
    let mockLogger;

    beforeEach(() => {
        mockTracker = vi.fn();

        mockLogger = {
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        nock.cleanAll();
    });

    describe('getVariant', () => {
        let provider;

        beforeEach(() => {
            const config = {
                api_host: 'localhost',
                enable_polling: false,
                logger: mockLogger,
            };

            provider = new LocalFeatureFlagsProvider(TEST_TOKEN, config, mockTracker);
        });

        afterEach(() => {
            provider.stopPollingForDefinitions();
        });

        it('should return fallback when no flag definitions', async () => {
            mockFlagDefinitionsResponse([]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('nonexistent_flag', { variant_value: 'control' }, TEST_CONTEXT);
            expect(result.variant_value).toBe('control');
            expect(mockTracker).not.toHaveBeenCalled();
        });

        it('should return fallback if flag definition call fails', async () => {
            mockFailedFlagDefinitionsResponse(500);

            await provider.startPollingForDefinitions();
            const result = provider.getVariant('nonexistent_flag', { variant_value: 'control' }, TEST_CONTEXT);
            expect(result.variant_value).toBe('control');
        });

        it('should return fallback when flag does not exist', async () => {
            const otherFlag = createTestFlag({ flagKey: 'other_flag' });
            mockFlagDefinitionsResponse([otherFlag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('nonexistent_flag', { variant_value: 'control' }, TEST_CONTEXT);
            expect(result.variant_value).toBe('control');
        });

        it('should return fallback when no context', async () => {
            const flag = createTestFlag({ context: 'distinct_id' });
            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, {});
            expect(result.variant_value).toBe('fallback');
        });

        it('should return fallback when wrong context key', async () => {
            const flag = createTestFlag({ context: 'user_id' });
            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, { distinct_id: 'user123' });
            expect(result.variant_value).toBe('fallback');
        });

        it('should return test user variant when configured', async () => {
            const variants = [
                { key: 'control', value: 'false', is_control: true, split: 50.0 },
                { key: 'treatment', value: 'true', is_control: false, split: 50.0 }
            ];
            const flag = createTestFlag({
                variants: variants,
                testUsers: { 'test_user': 'treatment' }
            });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'control' }, { distinct_id: 'test_user' });
            expect(result.variant_value).toBe('true');
        });

        it('should return correct variant when test user variant not configured', async () => {
            const variants = [
                { key: 'control', value: 'false', is_control: true, split: 50.0 },
                { key: 'treatment', value: 'true', is_control: false, split: 50.0 }
            ];
            const flag = createTestFlag({
                variants: variants,
                testUsers: { 'test_user': 'nonexistent_variant' }
            });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, { distinct_id: 'test_user' });
            expect(['false', 'true']).toContain(result.variant_value);
        });

        it('should return fallback when rollout percentage zero', async () => {
            const flag = createTestFlag({ rolloutPercentage: 0.0 });
            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, TEST_CONTEXT);
            expect(result.variant_value).toBe('fallback');
        });

        it('should return variant when rollout percentage hundred', async () => {
            const flag = createTestFlag({ rolloutPercentage: 100.0 });
            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, TEST_CONTEXT);
            expect(result.variant_value).not.toBe('fallback');
            expect(['control', 'treatment']).toContain(result.variant_value);
        });

        it('should respect runtime evaluation when satisfied', async () => {
            const runtimeEval = { plan: 'premium', region: 'US' };
            const flag = createTestFlag({ runtimeEvaluation: runtimeEval });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const context = {
                distinct_id: 'user123',
                custom_properties: {
                    plan: 'premium',
                    region: 'US'
                }
            };

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, context);
            expect(result.variant_value).not.toBe('fallback');
        });

        it('should return fallback when runtime evaluation not satisfied', async () => {
            const runtimeEval = { plan: 'premium', region: 'US' };
            const flag = createTestFlag({ runtimeEvaluation: runtimeEval });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const context = {
                distinct_id: 'user123',
                custom_properties: {
                    plan: 'basic',
                    region: 'US'
                }
            };

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, context);
            expect(result.variant_value).toBe('fallback');
        });

        it('should pick correct variant with hundred percent split', async () => {
            const variants = [
                { key: 'A', value: 'variant_a', is_control: false, split: 100.0 },
                { key: 'B', value: 'variant_b', is_control: false, split: 0.0 },
                { key: 'C', value: 'variant_c', is_control: false, split: 0.0 }
            ];
            const flag = createTestFlag({ variants: variants, rolloutPercentage: 100.0 });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, TEST_CONTEXT);
            expect(result.variant_value).toBe('variant_a');
        });

        it('should pick correct variant with half migrated group splits', async () => {
            const variants = [
                { key: 'A', value: 'variant_a', is_control: false, split: 100.0 },
                { key: 'B', value: 'variant_b', is_control: false, split: 0.0 },
                { key: 'C', value: 'variant_c', is_control: false, split: 0.0 }
            ];
            const variantSplits = { A: 0.0, B: 100.0, C: 0.0 };
            const flag = createTestFlag({
                variants: variants,
                rolloutPercentage: 100.0,
                variantSplits: variantSplits
            });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, TEST_CONTEXT);
            expect(result.variant_value).toBe('variant_b');
        });

        it('should pick correct variant with full migrated group splits', async () => {
            const variants = [
                { key: 'A', value: 'variant_a', is_control: false },
                { key: 'B', value: 'variant_b', is_control: false },
                { key: 'C', value: 'variant_c', is_control: false }
            ];
            const variantSplits = { A: 0.0, B: 0.0, C: 100.0 };
            const flag = createTestFlag({
                variants: variants,
                rolloutPercentage: 100.0,
                variantSplits: variantSplits
            });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'fallback' }, TEST_CONTEXT);
            expect(result.variant_value).toBe('variant_c');
        });

        it('should pick overridden variant', async () => {
            const variants = [
                { key: 'A', value: 'variant_a', is_control: false, split: 100.0 },
                { key: 'B', value: 'variant_b', is_control: false, split: 0.0 }
            ];
            const flag = createTestFlag({
                variants: variants,
                variantOverride: { key: 'B' }
            });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariant('test_flag', { variant_value: 'control' }, TEST_CONTEXT);
            expect(result.variant_value).toBe('variant_b');
        });

        it('should track exposure when variant selected', async () => {
            const flag = createTestFlag();
            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            provider.getVariant('test_flag', { variant_value: 'fallback' }, TEST_CONTEXT);
            expect(mockTracker).toHaveBeenCalledTimes(1);
        });

        it('should track exposure with correct properties', async () => {
            const flag = createTestFlag({
                experimentId: 'exp-123',
                isExperimentActive: true,
                testUsers: { 'qa_user': 'treatment' }
            });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            provider.getVariant('test_flag', { variant_value: 'fallback' }, { distinct_id: 'qa_user' });

            expect(mockTracker).toHaveBeenCalledTimes(1);

            const call = mockTracker.mock.calls[0];
            const properties = call[2];

            expect(properties['$experiment_id']).toBe('exp-123');
            expect(properties['$is_experiment_active']).toBe(true);
            expect(properties['$is_qa_tester']).toBe(true);
        });

        it('should not track exposure on fallback', async () => {
            mockFlagDefinitionsResponse([]);
            await provider.startPollingForDefinitions();

            provider.getVariant('nonexistent_flag', { variant_value: 'fallback' }, TEST_CONTEXT);
            expect(mockTracker).not.toHaveBeenCalled();
        });

        it('should not track exposure without distinct_id', async () => {
            const flag = createTestFlag({ context: 'company' });
            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            provider.getVariant('test_flag', { variant_value: 'fallback' }, { company_id: 'company123' });
            expect(mockTracker).not.toHaveBeenCalled();
        });
    });

    describe('getAllVariants', () => {
        let provider;

        beforeEach(() => {
            const config = {
                api_host: 'localhost',
                enable_polling: false,
                logger: mockLogger,
            };

            provider = new LocalFeatureFlagsProvider(TEST_TOKEN, config, mockTracker);
        });

        afterEach(() => {
            provider.stopPollingForDefinitions();
        });

        it('should return empty object when no flag definitions', async () => {
            mockFlagDefinitionsResponse([]);
            await provider.startPollingForDefinitions();

            const result = provider.getAllVariants(TEST_CONTEXT);

            expect(result).toEqual({});
        });

        it('should return all variants when two flags have 100% rollout', async () => {
            const flag1 = createTestFlag({ flagKey: 'flag1', rolloutPercentage: 100.0 });
            const flag2 = createTestFlag({ flagKey: 'flag2', rolloutPercentage: 100.0 });

            mockFlagDefinitionsResponse([flag1, flag2]);
            await provider.startPollingForDefinitions();

            const result = provider.getAllVariants(TEST_CONTEXT);

            expect(Object.keys(result).length).toBe(2);
            expect(result).toHaveProperty('flag1');
            expect(result).toHaveProperty('flag2');
        });

        it('should return partial results when one flag has 0% rollout', async () => {
            const flag1 = createTestFlag({ flagKey: 'flag1', rolloutPercentage: 100.0 });
            const flag2 = createTestFlag({ flagKey: 'flag2', rolloutPercentage: 0.0 });

            mockFlagDefinitionsResponse([flag1, flag2]);
            await provider.startPollingForDefinitions();

            const result = provider.getAllVariants(TEST_CONTEXT);

            expect(Object.keys(result).length).toBe(1);
            expect(result).toHaveProperty('flag1');
            expect(result).not.toHaveProperty('flag2');
        });
    });

    describe('getVariantValue', () => {
        let provider;

        beforeEach(() => {
            const config = {
                api_host: 'localhost',
                enable_polling: false,
                logger: mockLogger,
            };

            provider = new LocalFeatureFlagsProvider(TEST_TOKEN, config, mockTracker);
        });

        afterEach(() => {
            provider.stopPollingForDefinitions();
        });

        it('should return variant value when flag exists', async () => {
            const variants = [
                { key: 'treatment', value: 'blue', is_control: false, split: 100.0 }
            ];
            const flag = createTestFlag({ variants: variants, rolloutPercentage: 100.0 });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariantValue('test_flag', 'default', TEST_CONTEXT);

            expect(result).toBe('blue');
        });

        it('should return fallback value when flag doesn\'t exist', async () => {
            mockFlagDefinitionsResponse([]);
            await provider.startPollingForDefinitions();

            const result = provider.getVariantValue('nonexistent_flag', 'default_value', TEST_CONTEXT);

            expect(result).toBe('default_value');
        });
    });

    describe('isEnabled', () => {
        let provider;

        beforeEach(() => {
            const config = {
                api_host: 'localhost',
                enable_polling: false,
                logger: mockLogger,
            };

            provider = new LocalFeatureFlagsProvider(TEST_TOKEN, config, mockTracker);
        });

        afterEach(() => {
            provider.stopPollingForDefinitions();
        });

        it('should return true when variant value is boolean true', async () => {
            const variants = [
                { key: 'treatment', value: true, is_control: false, split: 100.0 }
            ];
            const flag = createTestFlag({ variants: variants, rolloutPercentage: 100.0 });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.isEnabled('test_flag', TEST_CONTEXT);

            expect(result).toBe(true);
        });

        it('should return false when variant value is boolean false', async () => {
            const variants = [
                { key: 'control', value: false, is_control: true, split: 100.0 }
            ];
            const flag = createTestFlag({ variants: variants, rolloutPercentage: 100.0 });

            mockFlagDefinitionsResponse([flag]);
            await provider.startPollingForDefinitions();

            const result = provider.isEnabled('test_flag', TEST_CONTEXT);

            expect(result).toBe(false);
        });
    });
});
