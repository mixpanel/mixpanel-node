/**
 * Base Feature Flags Provider
 * Contains common methods for feature flag evaluation
 */

const https = require("https");
const packageInfo = require("../../package.json");
const {
  prepareCommonQueryParams,
  generateTraceparent,
  EXPOSURE_EVENT,
  REQUEST_HEADERS,
} = require("./utils");

/**
 * @typedef {import('./types').SelectedVariant} SelectedVariant
 * @typedef {import('./types').FlagContext} FlagContext
 */
class FeatureFlagsProvider {
  /**
   * @param {Object} providerConfig - Configuration object with token, api_host, request_timeout_in_seconds
   * @param {string} endpoint - API endpoint path (e.g., '/flags' or '/flags/definitions')
   * @param {Function} tracker - Function to track events (signature: track(distinct_id, event, properties, callback))
   * @param {string} evaluationMode - The feature flag evaluation mode
   * @param {CustomLogger} logger - Logger instance
   */
  constructor(providerConfig, endpoint, tracker, evaluationMode, logger) {
    this.providerConfig = providerConfig;
    this.endpoint = endpoint;
    this.tracker = tracker;
    this.evaluationMode = evaluationMode;
    this.logger = logger;
  }

  /**
   * Common HTTP request handler for flags API endpoints
   * @param {Object} additionalParams - Additional query parameters to append
   * @returns {Promise<Object>} - Parsed JSON response
   */
  async callFlagsEndpoint(additionalParams = null) {
    return new Promise((resolve, reject) => {
      const commonParams = prepareCommonQueryParams(
        this.providerConfig.token,
        packageInfo.version,
      );
      const params = new URLSearchParams(commonParams);

      if (additionalParams) {
        for (const [key, value] of Object.entries(additionalParams)) {
          params.append(key, value);
        }
      }

      const path = `${this.endpoint}?${params.toString()}`;

      const requestOptions = {
        host: this.providerConfig.api_host,
        port: 443,
        path: path,
        method: "GET",
        headers: {
          ...REQUEST_HEADERS,
          Authorization:
            "Basic " +
            Buffer.from(this.providerConfig.token + ":").toString("base64"),
          traceparent: generateTraceparent(),
        },
        timeout: this.providerConfig.request_timeout_in_seconds * 1000,
      };

      const request = https.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode !== 200) {
            this.logger?.error(
              `HTTP ${res.statusCode} error calling flags endpoint: ${data}`,
            );
            return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }

          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (parseErr) {
            this.logger?.error(
              `Failed to parse JSON response: ${parseErr.message}`,
            );
            reject(parseErr);
          }
        });
      });

      request.on("error", (err) => {
        this.logger?.error(
          `Network error calling flags endpoint: ${err.message}`,
        );
        reject(err);
      });

      request.on("timeout", () => {
        this.logger?.error(`Request timeout calling flags endpoint`);
        request.destroy();
        reject(new Error("Request timeout"));
      });

      request.end();
    });
  }

  /**
   * Manually tracks a feature flag exposure event to Mixpanel
   * This provides flexibility for reporting individual exposure events when using getAllVariants
   * If using getVariantValue or getVariant, exposure events are tracked automatically by default.
   * @param {string} flagKey - The key of the feature flag
   * @param {SelectedVariant} variant - The selected variant for the feature flag
   * @param {FlagContext} context - The user context used to evaluate the feature flag
   * @param {number|null} latencyMs - Optionally included latency in milliseconds that assignment took.
   */
  trackExposureEvent(flagKey, selectedVariant, context, latencyMs = null) {
    if (!context.distinct_id) {
      this.logger?.error(
        "Cannot track exposure event without a distinct_id in the context",
      );
      return;
    }

    const properties = {
      distinct_id: context.distinct_id,
      "Experiment name": flagKey,
      "Variant name": selectedVariant.variant_key,
      $experiment_type: "feature_flag",
      "Flag evaluation mode": this.evaluationMode,
    };

    if (latencyMs !== null && latencyMs !== undefined) {
      properties["Variant fetch latency (ms)"] = latencyMs;
    }

    if (selectedVariant.experiment_id !== undefined) {
      properties["$experiment_id"] = selectedVariant.experiment_id;
    }

    if (selectedVariant.is_experiment_active !== undefined) {
      properties["$is_experiment_active"] =
        selectedVariant.is_experiment_active;
    }

    if (selectedVariant.is_qa_tester !== undefined) {
      properties["$is_qa_tester"] = selectedVariant.is_qa_tester;
    }

    // Use the tracker function provided (bound to the main mixpanel instance)
    this.tracker(EXPOSURE_EVENT, properties, (err) => {
      if (err) {
        this.logger?.error(
          `[flags]Failed to track exposure event for flag '${flagKey}': ${err.message}`,
        );
      }
    });
  }
}

module.exports = FeatureFlagsProvider;
