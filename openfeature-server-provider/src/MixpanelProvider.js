const { ErrorCode } = require("@openfeature/server-sdk");

const FALLBACK_SENTINEL = Symbol("mixpanel-openfeature-fallback");

class MixpanelProvider {
  metadata = { name: "mixpanel-provider" };

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

  async initialize(context) {
    if (context && Object.keys(context).length > 0) {
      this._context = context;
    }
    this._initialized = true;
  }

  async onClose() {
    // No cleanup needed - Mixpanel SDK manages its own lifecycle
  }

  async resolveBooleanEvaluation(flagKey, defaultValue, context, _logger) {
    const result = await this._resolveFlag(flagKey, defaultValue, context);
    if (result.errorCode) {
      return result;
    }

    if (typeof result.value !== "boolean") {
      return createErrorResolution(
        defaultValue,
        ErrorCode.TYPE_MISMATCH,
        `Flag "${flagKey}" value is not a boolean: ${typeof result.value}`,
      );
    }

    return result;
  }

  async resolveStringEvaluation(flagKey, defaultValue, context, _logger) {
    const result = await this._resolveFlag(flagKey, defaultValue, context);
    if (result.errorCode) {
      return result;
    }

    if (typeof result.value !== "string") {
      return createErrorResolution(
        defaultValue,
        ErrorCode.TYPE_MISMATCH,
        `Flag "${flagKey}" value is not a string: ${typeof result.value}`,
      );
    }

    return result;
  }

  async resolveNumberEvaluation(flagKey, defaultValue, context, _logger) {
    const result = await this._resolveFlag(flagKey, defaultValue, context);
    if (result.errorCode) {
      return result;
    }

    if (typeof result.value !== "number") {
      return createErrorResolution(
        defaultValue,
        ErrorCode.TYPE_MISMATCH,
        `Flag "${flagKey}" value is not a number: ${typeof result.value}`,
      );
    }

    return result;
  }

  async resolveObjectEvaluation(flagKey, defaultValue, context, _logger) {
    const result = await this._resolveFlag(flagKey, defaultValue, context);
    if (result.errorCode) {
      return result;
    }

    if (
      typeof result.value !== "object" ||
      result.value === null ||
      Array.isArray(result.value)
    ) {
      return createErrorResolution(
        defaultValue,
        ErrorCode.TYPE_MISMATCH,
        `Flag "${flagKey}" value is not an object: ${typeof result.value}`,
      );
    }

    return result;
  }

  _buildFlagContext(evaluationContext) {
    const flagContext = { ...this._context };
    if (evaluationContext && Object.keys(evaluationContext).length > 0) {
      for (const [key, value] of Object.entries(evaluationContext)) {
        flagContext[key] = value;
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
        ErrorCode.PROVIDER_NOT_READY,
        `Flag evaluation failed: ${err.message}`,
      );
    }

    if (variant.variant_key === FALLBACK_SENTINEL) {
      return createErrorResolution(
        defaultValue,
        ErrorCode.FLAG_NOT_FOUND,
        `Flag "${flagKey}" not found`,
      );
    }

    return {
      value: variant.variant_value,
      variant: variant.variant_key,
      reason: "STATIC",
    };
  }
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
