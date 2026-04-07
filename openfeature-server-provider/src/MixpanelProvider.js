const { ErrorCode } = require("@openfeature/server-sdk");
const Mixpanel = require("mixpanel");

const FALLBACK_SENTINEL = Symbol("mixpanel-openfeature-fallback");

/**
 * OpenFeature provider for Mixpanel feature flags.
 * Wraps a Mixpanel flags provider (local or remote) to implement the OpenFeature Provider interface.
 */
class MixpanelProvider {
  metadata = { name: "mixpanel-provider" };

  /**
   * @param {MixpanelFlagsProvider} flagsProvider - A Mixpanel flags provider instance (e.g. mixpanel.local_flags or mixpanel.remote_flags)
   */
  constructor(flagsProvider) {
    if (!flagsProvider) {
      throw new Error("flagsProvider is required");
    }
    if (typeof flagsProvider.getVariant !== "function") {
      throw new Error(
        "Invalid flagsProvider: missing required method getVariant",
      );
    }
    this._flagsProvider = flagsProvider;
    this._context = {};
    this._initialized = false;
  }

  /**
   * Create a provider using local flag evaluation.
   * Initializes a Mixpanel instance, starts polling for flag definitions, and returns a ready provider.
   * @param {string} token - Mixpanel project token
   * @param {LocalFlagsConfig} [config] - Local flags configuration
   * @returns {MixpanelProvider}
   */
  static createLocal(token, config) {
    const mixpanel = Mixpanel.init(token, { local_flags_config: config });
    const flagsProvider = mixpanel.local_flags;
    flagsProvider.startPollingForDefinitions();
    const provider = new MixpanelProvider(flagsProvider);
    provider.mixpanel = mixpanel;
    return provider;
  }

  /**
   * Create a provider using remote flag evaluation.
   * Initializes a Mixpanel instance configured for server-side flag evaluation.
   * @param {string} token - Mixpanel project token
   * @param {RemoteFlagsConfig} [config] - Remote flags configuration
   * @returns {MixpanelProvider}
   */
  static createRemote(token, config) {
    const mixpanel = Mixpanel.init(token, { remote_flags_config: config });
    const flagsProvider = mixpanel.remote_flags;
    const provider = new MixpanelProvider(flagsProvider);
    provider.mixpanel = mixpanel;
    return provider;
  }

  /**
   * Initialize the provider. Waits for flag definitions to be fetched if using a local provider.
   * @param {EvaluationContext} [context] - Global evaluation context to use for all flag evaluations
   * @returns {Promise<void>}
   */
  async initialize(context) {
    if (context && Object.keys(context).length > 0) {
      this._context = context;
    }
    if (typeof this._flagsProvider.areFlagsReady === "function") {
      await this._flagsProvider.areFlagsReady();
    }
    this._initialized = true;
  }

  /**
   * Clean up resources. Stops polling for flag definitions if active.
   * @returns {Promise<void>}
   */
  async onClose() {
    if (typeof this._flagsProvider.shutdown === "function") {
      await this._flagsProvider.shutdown();
    }
  }

  /** @param {string} flagKey @param {boolean} defaultValue @param {EvaluationContext} context @param {Logger} _logger @returns {Promise<ResolutionDetails<boolean>>} */
  async resolveBooleanEvaluation(flagKey, defaultValue, context, _logger) {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "boolean");
  }

  /** @param {string} flagKey @param {string} defaultValue @param {EvaluationContext} context @param {Logger} _logger @returns {Promise<ResolutionDetails<string>>} */
  async resolveStringEvaluation(flagKey, defaultValue, context, _logger) {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "string");
  }

  /** @param {string} flagKey @param {number} defaultValue @param {EvaluationContext} context @param {Logger} _logger @returns {Promise<ResolutionDetails<number>>} */
  async resolveNumberEvaluation(flagKey, defaultValue, context, _logger) {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "number");
  }

  /** @param {string} flagKey @param {Object} defaultValue @param {EvaluationContext} context @param {Logger} _logger @returns {Promise<ResolutionDetails<Object>>} */
  async resolveObjectEvaluation(flagKey, defaultValue, context, _logger) {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "object");
  }

  async _resolveTypedFlag(flagKey, defaultValue, context, expectedType) {
    const result = await this._resolveFlag(flagKey, defaultValue, context);
    if (result.errorCode) {
      return result;
    }

    if (!isExpectedType(result.value, expectedType)) {
      return createErrorResolution(
        defaultValue,
        ErrorCode.TYPE_MISMATCH,
        `Flag "${flagKey}" value is not ${expectedType}: ${typeof result.value}`,
      );
    }

    return result;
  }

  _unwrapValue(value) {
    if (value == null) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this._unwrapValue(item));
    }

    if (typeof value === "object") {
      const result = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this._unwrapValue(v);
      }
      return result;
    }

    return value;
  }

  _buildFlagContext(evaluationContext) {
    const flagContext = { ...this._context };
    if (evaluationContext && Object.keys(evaluationContext).length > 0) {
      for (const [key, value] of Object.entries(evaluationContext)) {
        flagContext[key] = this._unwrapValue(value);
      }
    }
    return flagContext;
  }

  async _resolveFlag(flagKey, defaultValue, context) {
    if (!this._initialized) {
      return createErrorResolution(
        defaultValue,
        ErrorCode.PROVIDER_NOT_READY,
        "Mixpanel provider has not been initialized",
      );
    }

    const fallbackVariant = {
      variant_key: FALLBACK_SENTINEL,
      variant_value: defaultValue,
    };

    const flagContext = this._buildFlagContext(context);

    let variant;
    try {
      variant = await this._flagsProvider.getVariant(
        flagKey,
        fallbackVariant,
        flagContext,
        true,
      );
    } catch (err) {
      return createErrorResolution(
        defaultValue,
        ErrorCode.GENERAL,
        `Flag evaluation failed: ${err.message}`,
      );
    }

    if (variant.variant_key === FALLBACK_SENTINEL) {
      return {
        value: defaultValue,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        errorMessage: `Flag "${flagKey}" not found`,
        reason: "DEFAULT",
      };
    }

    return {
      value: variant.variant_value,
      variant: variant.variant_key,
      reason: "TARGETING_MATCH",
    };
  }
}

function isExpectedType(value, expectedType) {
  if (expectedType === "object") {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  return typeof value === expectedType;
}

function createErrorResolution(defaultValue, errorCode, errorMessage) {
  return {
    value: defaultValue,
    errorCode,
    errorMessage,
    reason: "ERROR",
  };
}

module.exports = { MixpanelProvider };
