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
    if (typeof this._flagsProvider.areFlagsReady === "function") {
      await this._flagsProvider.areFlagsReady();
    }
    this._initialized = true;
  }

  async onClose() {
    if (typeof this._flagsProvider.shutdown === "function") {
      await this._flagsProvider.shutdown();
    }
  }

  async resolveBooleanEvaluation(flagKey, defaultValue, context, _logger) {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "boolean");
  }

  async resolveStringEvaluation(flagKey, defaultValue, context, _logger) {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "string");
  }

  async resolveNumberEvaluation(flagKey, defaultValue, context, _logger) {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "number");
  }

  async resolveObjectEvaluation(flagKey, defaultValue, context, _logger) {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "object");
  }

  async _resolveTypedFlag(flagKey, defaultValue, context, expectedType) {
    const result = await this._resolveFlag(flagKey, defaultValue, context);
    if (result.errorCode) {
      return result;
    }

    if (!isExpectedType(result.value, expectedType)) {
      const article = expectedType === "object" ? "an" : "a";
      return createErrorResolution(
        defaultValue,
        ErrorCode.TYPE_MISMATCH,
        `Flag "${flagKey}" value is not ${article} ${expectedType}: ${typeof result.value}`,
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
