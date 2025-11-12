/**
 * Local Feature Flags Provider
 * Evaluates feature flags client-side using locally cached definitions
 */

/**
 *  @typedef {import('./types').SelectedVariant} SelectedVariant
 *  @typedef {import('./types').FlagContext} FlagContext
 *  @typedef {import('./types').LocalFlagsConfig} LocalFlagsConfig
 *  @typedef {import('./types').ExperimentationFlag} ExperimentationFlag
 *  @typedef {import('./types').LocalFlagsResponse} LocalFlagsResponse
 * */

const FeatureFlagsProvider = require('./flags');
const { normalizedHash } = require('./utils');

class LocalFeatureFlagsProvider extends FeatureFlagsProvider {
    /**
     * @param {string} token - Mixpanel project token
     * @param {LocalFlagsConfig} config - Local flags configuration
     * @param {Function} tracker - Function to track events (signature: track(distinct_id, event, properties, callback))
     * @param {CustomLogger} logger - Logger
     */
    constructor(token, config, tracker, logger) {
        const mergedConfig = {
            api_host: 'api.mixpanel.com',
            request_timeout_in_seconds: 10,
            enable_polling: true,
            polling_interval_in_seconds: 60,
            ...config,
        };

        const providerConfig = {
            token: token,
            api_host: mergedConfig.api_host,
            request_timeout_in_seconds: mergedConfig.request_timeout_in_seconds,
        };

        super(providerConfig, '/flags/definitions', tracker, 'local', logger);

        this.config = mergedConfig;
        this.flagDefinitions = new Map();
        this.pollingInterval = null;
    }

    /**
     * Start polling for flag definitions.
     * Fetches immediately and then at regular intervals if polling is enabled
     * @returns {Promise<void>}
     */
    async startPollingForDefinitions() {
        try {
            await this._fetchFlagDefinitions();

            if (this.config.enable_polling && !this.pollingInterval) {
                this.pollingInterval = setInterval(async () => {
                    try {
                        await this._fetchFlagDefinitions();
                    } catch (err) {
                        this.logger?.error(`Error polling for flag definition: ${err.message}`);
                    }
                }, this.config.polling_interval_in_seconds * 1000);
            }
        } catch (err) {
            this.logger?.error(`Initial flag definitions fetch failed: ${err.message}`);
        }
    }

    /**
     * Stop polling for flag definitions
     */
    stopPollingForDefinitions() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        } else {
            this.logger?.warn('stopPollingForDefinitions called but polling was not active');
        }
    }

    /**
     * Check if a feature flag is enabled
     * This method is intended only for flags defined as Mixpanel Feature Gates (boolean flags)
     * This checks that the variant value of a selected variant is concretely the boolean 'true'
     * It does not coerce other truthy values.
     * @param {string} flagKey - Feature flag key
     * @param {FlagContext} context - Evaluation context (must include distinct_id)
     * @returns {boolean}
     */
    isEnabled(flagKey, context) {
        const value = this.getVariantValue(flagKey, false, context);
        return value === true;
    }

    /**
     * Get the variant value for a feature flag
     * @param {string} flagKey - Feature flag key
     * @param {*} fallbackValue - Value to return if the user context is not in the rollout for a flag or if evaluation fails
     * @param {FlagContext} context - Evaluation context
     * @param {boolean} [reportExposure=true] - Whether to track exposure event
     * @returns {*} The variant value
     */
    getVariantValue(flagKey, fallbackValue, context, reportExposure = true) {
        const result = this.getVariant(flagKey, { variant_value: fallbackValue }, context, reportExposure);
        return result.variant_value;
    }

    /**
     * Get the complete variant information for a feature flag
     * @param {string} flagKey - Feature flag key
     * @param {SelectedVariant} fallbackVariant - Variant to return if flag evaluation fails
     * @param {FlagContext} context - Evaluation context (must include distinct_id)
     * @param {boolean} [reportExposure=true] - Whether to track exposure event
     * @returns {SelectedVariant}
     */
    getVariant(flagKey, fallbackVariant, context, reportExposure = true) {
        const flag = this.flagDefinitions.get(flagKey);

        if (!flag) {
            this.logger?.warn(`Cannot find flag definition for key: '${flagKey}`);
            return fallbackVariant;
        }

        if (!Object.hasOwn(context, flag.context)) {
            this.logger?.warn(
                `The variant assignment key, '${flag.context}' for flag, '${flagKey}' is not present in the supplied user context dictionary`
            );
            return fallbackVariant;
        }

        const contextValue = context[flag.context];

        let selectedVariant = null;

        const testUserVariant = this._getVariantOverrideForTestUser(flag, context);
        if (testUserVariant) {
            selectedVariant = testUserVariant;
        } else {
            const rollout = this._getAssignedRollout(flag, contextValue, context);
            if (rollout) {
                selectedVariant = this._getAssignedVariant(flag, contextValue, flagKey, rollout);
            }
        }

        if (selectedVariant) {
            if (reportExposure) {
                this.trackExposureEvent(flagKey, selectedVariant, context);
            }
            return selectedVariant;
        }

        return fallbackVariant;
    }

    /**
     * Get all feature flag variants for the current user context
     * Exposure events are not automatically tracked when this method is used
     * @param {FlagContext} context - Evaluation context (must include distinct_id)
     * @returns {{[key: string]: SelectedVariant}}
     */
    getAllVariants(context) {
        const variants = {};

        for (const flagKey of this.flagDefinitions.keys()) {
            const variant = this.getVariant(flagKey, null, context, false);
            if (variant !== null) {
                variants[flagKey] = variant;
            }
        }

        return variants;
    }

    /**
     * Fetch flag definitions from API.
     * @returns {Promise<LocalFlagsResponse>}
     */
    async _fetchFlagDefinitions() {
        const response = await this.callFlagsEndpoint();

        const newDefinitions = new Map();
        response.flags.forEach(flag => {
            newDefinitions.set(flag.key, flag);
        });

        this.flagDefinitions = newDefinitions;

        return response;
    }

    /**
     * Find a variant by key (case-insensitive) and return complete SelectedVariant
     * @param {string} variantKey - Variant key to find
     * @param {ExperimentationFlag} flag - Flag definition
     * @returns {SelectedVariant|null}
     */
    _getMatchingVariant(variantKey, flag) {
        for (const variant of flag.ruleset.variants) {
            if (variantKey.toLowerCase() === variant.key.toLowerCase()) {
                return {
                    variant_key: variant.key,
                    variant_value: variant.value,
                    experiment_id: flag.experiment_id,
                    is_experiment_active: flag.is_experiment_active,
                };
            }
        }
        return null;
    }

    _getVariantOverrideForTestUser(flag, context) {
        if (!flag.ruleset.test?.users) {
            return null;
        }

        const distinctId = context.distinct_id;
        if (!distinctId) {
            return null;
        }

        const variantKey = flag.ruleset.test.users[distinctId];
        if (!variantKey) {
            return null;
        }

        let selected_variant = this._getMatchingVariant(variantKey, flag);
        if (selected_variant) {
            selected_variant.is_qa_tester = true;
        }
        return selected_variant;
    }

    _getAssignedRollout(flag, contextValue, context) {
        for (let index = 0; index < flag.ruleset.rollout.length; index++) {
            const rollout = flag.ruleset.rollout[index];

            let salt;
            if (flag.hash_salt !== null && flag.hash_salt !== undefined) {
                salt = flag.key + flag.hash_salt + index.toString();
            } else {
                salt = flag.key + "rollout";
            }

            const rolloutHash = normalizedHash(String(contextValue), salt);

            if (rolloutHash < rollout.rollout_percentage &&
                this._isRuntimeEvaluationSatisfied(rollout, context)) {
                return rollout;
            }
        }

        return null;
    }

    _getAssignedVariant(flag, contextValue, flagKey, rollout) {
        if (rollout.variant_override) {
            const variant = this._getMatchingVariant(rollout.variant_override.key, flag);
            if (variant) {
                return { ...variant, is_qa_tester: false };
            }
        }

        const storedSalt = flag.hash_salt !== null && flag.hash_salt !== undefined ? flag.hash_salt : "";
        const salt = flagKey + storedSalt + "variant";
        const variantHash = normalizedHash(String(contextValue), salt);

        // Deep copy variants and apply splits
        const variants = flag.ruleset.variants.map(v => ({ ...v }));
        if (rollout.variant_splits) {
            for (const variant of variants) {
                if (variant.key in rollout.variant_splits) {
                    variant.split = rollout.variant_splits[variant.key];
                }
            }
        }

        let selected = variants[0];
        let cumulative = 0.0;
        for (const variant of variants) {
            selected = variant;
            cumulative += variant.split || 0.0;
            if (variantHash < cumulative) {
                break;
            }
        }

        return {
            variant_key: selected.key,
            variant_value: selected.value,
            experiment_id: flag.experiment_id,
            is_experiment_active: flag.is_experiment_active,
            is_qa_tester: false,
        };
    }

    _isRuntimeEvaluationSatisfied(rollout, context) {
        if (!rollout.runtime_evaluation_definition) {
            return true;
        }

        const customProperties = context.custom_properties;
        if (!customProperties || typeof customProperties !== 'object') {
            return false;
        }

        for (const [key, expectedValue] of Object.entries(rollout.runtime_evaluation_definition)) {
            if (!(key in customProperties)) {
                return false;
            }

            const actualValue = customProperties[key];
            if (String(actualValue).toLowerCase() !== String(expectedValue).toLowerCase()) {
                return false;
            }
        }
        return true;
    }
}

module.exports = LocalFeatureFlagsProvider;
