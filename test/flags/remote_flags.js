const nock = require('nock');
const RemoteFeatureFlagsProvider = require('../../lib/flags/remote_flags');

const mockSuccessResponse = (flags_with_selected_variant) => {
    const remote_response = {
        code: 200,
        flags: flags_with_selected_variant,
    };

    nock('https://localhost')
        .get('/flags')
        .query(true)
        .reply(200, remote_response);
};

describe('RemoteFeatureFlagProvider', () => {
    const flagsEndpointHostName = "localhost";
    const TEST_TOKEN = 'test-token';

    const TEST_CONTEXT = {
        distinct_id: 'test-user',
    };

    let provider;
    let mockTracker;

    beforeEach(() => {
        mockTracker = vi.fn();

        let mockLogger = {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn()
        };

        let config = {
            api_host: flagsEndpointHostName,
        };

        provider = new RemoteFeatureFlagsProvider(TEST_TOKEN, config, mockTracker, mockLogger);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        nock.cleanAll();
    });

    describe('getVariant', () => {
        it('should return variant when served', async () => {
            mockSuccessResponse({
                'new-feature': {
                    variant_key: 'on',
                    variant_value: true,
                }
            });

            const expectedVariant = {
                variant_key: 'on',
                variant_value: true,
            }

            const result = await provider.getVariant('new-feature', null, TEST_CONTEXT);

            expect(result).toEqual(expectedVariant);
        });

        it('should select fallback variant when no flags are served', async () => {
            nock('https://localhost')
                .get('/flags')
                .query(true)
                .reply(200, { code: 200, flags: {} });

            const fallbackVariant = {
                variant_key: 'control',
                variant_value: false,
            };

            const result = await provider.getVariant('any-flag', fallbackVariant, TEST_CONTEXT);

            expect(result).toEqual(fallbackVariant);
            expect(mockTracker).not.toHaveBeenCalled();
        });

        it('should select fallback variant if flag does not exist in served flags', async () => {
            mockSuccessResponse({
                'different-flag': {
                    variant_key: 'on',
                    variant_value: true,
                }
            });

            const fallbackVariant = {
                variant_key: 'control',
                variant_value: false,
            };

            const result = await provider.getVariant('missing-flag', fallbackVariant, TEST_CONTEXT);

            expect(result).toEqual(fallbackVariant);
            expect(mockTracker).not.toHaveBeenCalled();
        });

        it('No exposure events are tracked when fallback variant is selected', async () => {
            nock('https://localhost')
                .get('/flags')
                .query(true)
                .reply(200, { code: 200, flags: {} });

            const fallbackVariant = {
                variant_key: 'control',
                variant_value: false,
            };

            await provider.getVariant('any-flag', fallbackVariant, TEST_CONTEXT);

            expect(mockTracker).not.toHaveBeenCalled();
        });

        it('Exposure event is tracked when a variant is selected', async () => {
            mockSuccessResponse({
                'test-flag': {
                    variant_key: 'treatment',
                    variant_value: true,
                }
            });

            const fallbackVariant = {
                variant_key: 'control',
                variant_value: false,
            };

            const result = await provider.getVariant('test-flag', fallbackVariant, TEST_CONTEXT);

            expect(result).toEqual({
                variant_key: 'treatment',
                variant_value: true,
            });

            expect(mockTracker).toHaveBeenCalledTimes(1);

            expect(mockTracker).toHaveBeenCalledWith(
                '$experiment_started',
                expect.objectContaining({
                    'distinct_id': 'test-user',
                    'Experiment name': 'test-flag',
                    'Variant name': 'treatment',
                    '$experiment_type': 'feature_flag',
                    'Flag evaluation mode': 'remote'
                }),
                expect.any(Function)
            );
        });
    });

    describe('getVariantValue', () => {
        it('should return variant value when flag exists', async () => {
            mockSuccessResponse({
                'test-flag': {
                    variant_key: 'treatment',
                    variant_value: 'blue',
                }
            });

            const result = await provider.getVariantValue('test-flag', 'default', TEST_CONTEXT);

            expect(result).toEqual('blue');
        });

        it('should return fallback value when flag doesn\'t exist', async () => {
            mockSuccessResponse({
                'different-flag': {
                    variant_key: 'on',
                    variant_value: true,
                }
            });

            const result = await provider.getVariantValue('missing-flag', 'default-value', TEST_CONTEXT);

            expect(result).toEqual('default-value');
        });

        it('should track exposure event by default', async () => {
            mockSuccessResponse({
                'test-flag': {
                    variant_key: 'treatment',
                    variant_value: 'value',
                }
            });

            await provider.getVariantValue('test-flag', 'default', TEST_CONTEXT);

            expect(mockTracker).toHaveBeenCalledTimes(1);
            expect(mockTracker).toHaveBeenCalledWith(
                '$experiment_started',
                expect.objectContaining({
                    'Experiment name': 'test-flag',
                    'Variant name': 'treatment',
                }),
                expect.any(Function)
            );
        });

        it('should NOT track exposure event when reportExposure is false', async () => {
            mockSuccessResponse({
                'test-flag': {
                    variant_key: 'treatment',
                    variant_value: 'value',
                }
            });

            await provider.getVariantValue('test-flag', 'default', TEST_CONTEXT, false);

            expect(mockTracker).not.toHaveBeenCalled();
        });

        it('should handle different variant value types', async () => {
            // Test string
            mockSuccessResponse({
                'string-flag': {
                    variant_key: 'treatment',
                    variant_value: 'text-value',
                }
            });
            let result = await provider.getVariantValue('string-flag', 'default', TEST_CONTEXT);
            expect(result).toEqual('text-value');

            // Test number
            nock.cleanAll();
            mockSuccessResponse({
                'number-flag': {
                    variant_key: 'treatment',
                    variant_value: 42,
                }
            });
            result = await provider.getVariantValue('number-flag', 0, TEST_CONTEXT);
            expect(result).toEqual(42);

            // Test object
            nock.cleanAll();
            mockSuccessResponse({
                'object-flag': {
                    variant_key: 'treatment',
                    variant_value: { key: 'value' },
                }
            });
            result = await provider.getVariantValue('object-flag', {}, TEST_CONTEXT);
            expect(result).toEqual({ key: 'value' });
        });

        it('should return fallback on network error', async () => {
            nock('https://localhost')
                .get('/flags')
                .query(true)
                .replyWithError('Network error');

            const result = await provider.getVariantValue('test-flag', 'fallback', TEST_CONTEXT);

            expect(result).toEqual('fallback');
        });

        it('should return fallback when no flags are served', async () => {
            nock('https://localhost')
                .get('/flags')
                .query(true)
                .reply(200, { code: 200, flags: {} });

            const result = await provider.getVariantValue('test-flag', 'fallback', TEST_CONTEXT);

            expect(result).toEqual('fallback');
        });

        it('should NOT track exposure when fallback is returned', async () => {
            nock('https://localhost')
                .get('/flags')
                .query(true)
                .reply(200, { code: 200, flags: {} });

            await provider.getVariantValue('test-flag', 'fallback', TEST_CONTEXT);

            expect(mockTracker).not.toHaveBeenCalled();
        });
    });

    describe('getAllVariants', () => {
        it('should return all variants from API', async () => {
            mockSuccessResponse({
                'flag-1': {
                    variant_key: 'treatment',
                    variant_value: true,
                },
                'flag-2': {
                    variant_key: 'control',
                    variant_value: false,
                },
                'flag-3': {
                    variant_key: 'blue',
                    variant_value: 'blue-theme',
                }
            });

            const result = await provider.getAllVariants(TEST_CONTEXT);

            expect(result).toEqual({
                'flag-1': {
                    variant_key: 'treatment',
                    variant_value: true,
                },
                'flag-2': {
                    variant_key: 'control',
                    variant_value: false,
                },
                'flag-3': {
                    variant_key: 'blue',
                    variant_value: 'blue-theme',
                }
            });
        });

        it('should return empty object when no flags served', async () => {
            nock('https://localhost')
                .get('/flags')
                .query(true)
                .reply(200, { code: 200, flags: {} });

            const result = await provider.getAllVariants(TEST_CONTEXT);

            expect(result).toEqual({});
        });

        it('should NOT track any exposure events', async () => {
            mockSuccessResponse({
                'flag-1': {
                    variant_key: 'treatment',
                    variant_value: true,
                },
                'flag-2': {
                    variant_key: 'control',
                    variant_value: false,
                }
            });

            await provider.getAllVariants(TEST_CONTEXT);

            expect(mockTracker).not.toHaveBeenCalled();
        });
    });

    describe('isEnabled', () => {
        it('should return true when variant value is boolean true', async () => {
            mockSuccessResponse({
                'test-flag': {
                    variant_key: 'on',
                    variant_value: true,
                }
            });

            const result = await provider.isEnabled('test-flag', TEST_CONTEXT);

            expect(result).toBe(true);
        });

        it('should return false when variant value is boolean false', async () => {
            mockSuccessResponse({
                'test-flag': {
                    variant_key: 'off',
                    variant_value: false,
                }
            });

            const result = await provider.isEnabled('test-flag', TEST_CONTEXT);

            expect(result).toBe(false);
        });

        it('should return false for truthy non-boolean values', async () => {
            // Test string "true"
            mockSuccessResponse({
                'string-flag': {
                    variant_key: 'treatment',
                    variant_value: 'true',
                }
            });
            let result = await provider.isEnabled('string-flag', TEST_CONTEXT);
            expect(result).toBe(false);

            // Test number 1
            nock.cleanAll();
            mockSuccessResponse({
                'number-flag': {
                    variant_key: 'treatment',
                    variant_value: 1,
                }
            });
            result = await provider.isEnabled('number-flag', TEST_CONTEXT);
            expect(result).toBe(false);
        });

        it('should return false when flag doesn\'t exist', async () => {
            mockSuccessResponse({
                'different-flag': {
                    variant_key: 'on',
                    variant_value: true,
                }
            });

            const result = await provider.isEnabled('missing-flag', TEST_CONTEXT);

            expect(result).toBe(false);
        });

        it('should track exposure event', async () => {
            mockSuccessResponse({
                'test-flag': {
                    variant_key: 'on',
                    variant_value: true,
                }
            });

            await provider.isEnabled('test-flag', TEST_CONTEXT);

            expect(mockTracker).toHaveBeenCalledTimes(1);
            expect(mockTracker).toHaveBeenCalledWith(
                '$experiment_started',
                expect.objectContaining({
                    'Experiment name': 'test-flag',
                    'Variant name': 'on',
                }),
                expect.any(Function)
            );
        });

        it('should return false on network error', async () => {
            nock('https://localhost')
                .get('/flags')
                .query(true)
                .replyWithError('Network error');

            const result = await provider.isEnabled('test-flag', TEST_CONTEXT);

            expect(result).toBe(false);
        });
    });
});
