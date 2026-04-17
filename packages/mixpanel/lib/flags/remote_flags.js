/**
 * Remote Feature Flags Provider
 * Evaluates feature flags via server-side API requests
 */

/**
 * @typedef {import('./types').SelectedVariant} SelectedVariant
 * @typedef {import('./types').FlagContext} FlagContext
 * @typedef {import('./types').RemoteFlagsConfig} RemoteFlagsConfig
 * @typedef {import('./types').RemoteFlagsResponse} RemoteFlagsResponse
 */

const FeatureFlagsProvider = require("./flags");

class RemoteFeatureFlagsProvider extends FeatureFlagsProvider {
  /**
   * @param {string} token - Mixpanel project token
   * @param {RemoteFlagsConfig} config - Remote flags configuration
   * @param {Function} tracker - Function to track events (signature: track(distinct_id, event, properties, callback))
   * @param {CustomLogger} logger - Logger instance
   */
  constructor(token, config, tracker, logger) {
    const mergedConfig = {
      api_host: "api.mixpanel.com",
      request_timeout_in_seconds: 10,
      ...config,
    };

    const providerConfig = {
      token: token,
      api_host: mergedConfig.api_host,
      request_timeout_in_seconds: mergedConfig.request_timeout_in_seconds,
    };

    super(providerConfig, "/flags", tracker, "remote", logger);
  }

  /**
   * Get the variant value for a feature flag
   * If the user context is eligible for the rollout, one of the flag variants will be selected and an exposure event will be tracked to Mixpanel.
   * If the user context is not eligible, the fallback value is returned.
   * @param {string} flagKey - Feature flag key
   * @param {*} fallbackValue - Value to return if flag evaluation fails
   * @param {FlagContext} context - Evaluation context
   * @param {boolean} reportExposure - Whether to track exposure event
   * @returns {Promise<*>} - Variant value
   */
  async getVariantValue(
    flagKey,
    fallbackValue,
    context,
    reportExposure = true,
  ) {
    try {
      const selectedVariant = await this.getVariant(
        flagKey,
        { variant_value: fallbackValue },
        context,
        reportExposure,
      );
      return selectedVariant.variant_value;
    } catch (err) {
      this.logger?.error(
        `Failed to get variant value for flag '${flagKey}': ${err.message}`,
      );
      return fallbackValue;
    }
  }

  /**
   * Get the complete variant information for a feature flag
   * If the user context is eligible for the rollout, one of the flag variants will be selected and an exposure event will be tracked to Mixpanel.
   * If the user context is not eligible, the fallback value is returned.
   * @param {string} flagKey - Feature flag key
   * @param {SelectedVariant} fallbackVariant - Variant to return if flag evaluation fails
   * @param {FlagContext} context - Evaluation context
   * @param {boolean} reportExposure - Whether to track exposure event in the event that the user context is eligible for the rollout.
   * @returns {Promise<SelectedVariant>} - Selected variant
   */
  async getVariant(flagKey, fallbackVariant, context, reportExposure = true) {
    try {
      const startTime = Date.now();
      const response = await this._fetchFlags(context, flagKey);
      const latencyMs = Date.now() - startTime;

      const flags = response.flags || {};
      const selectedVariant = flags[flagKey];
      if (!selectedVariant) {
        return fallbackVariant;
      }

      if (reportExposure) {
        this.trackExposureEvent(flagKey, selectedVariant, context, latencyMs);
      }

      return selectedVariant;
    } catch (err) {
      this.logger?.error(
        `Failed to get variant for flag '${flagKey}': ${err.message}`,
      );
      return fallbackVariant;
    }
  }

  /**
   * This method is intended only for flags defined as Mixpanel Feature Gates (boolean flags)
   * This checks that the variant value of a selected variant is concretely the boolean 'true'
   * It does not coerce other truthy values.
   * @param {string} flagKey - Feature flag key
   * @param {FlagContext} context - User's evaluation context
   * @returns {Promise<boolean>} - Whether the flag is enabled
   */
  async isEnabled(flagKey, context) {
    try {
      const value = await this.getVariantValue(flagKey, false, context);
      return value === true;
    } catch (err) {
      this.logger?.error(
        `Failed to check if flag '${flagKey}' is enabled: ${err.message}`,
      );
      return false;
    }
  }

  /**
   * Get all feature flag variants for the current user context from remote server
   * Exposure events are not automatically tracked when this method is used
   * @param {FlagContext} context - User's evaluation context
   * @returns {Promise<{[key: string]: SelectedVariant}|null>} - Dictionary mapping flag keys to variants, or null if the call fails
   */
  async getAllVariants(context) {
    try {
      const response = await this._fetchFlags(context);
      return response.flags || {};
    } catch (err) {
      this.logger?.error(`Failed to get all remote variants: ${err.message}`);
      return null;
    }
  }

  /**
   * Fetch flags from remote flags evaluation API
   * @param {FlagContext} context - Evaluation context
   * @param {string} [flagKey] - Optional flag key (if omitted, fetches all flags)
   * @returns {Promise<RemoteFlagsResponse>} - API response containing flags dictionary
   */
  _fetchFlags(context, flagKey = null) {
    const additionalParams = {
      context: JSON.stringify(context),
    };

    if (flagKey !== null) {
      additionalParams.flag_key = flagKey;
    }

    return this.callFlagsEndpoint(additionalParams);
  }
}

module.exports = RemoteFeatureFlagsProvider;
