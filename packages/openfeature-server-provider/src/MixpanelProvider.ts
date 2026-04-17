import {
  ErrorCode,
  type Provider,
  type ResolutionDetails,
  type EvaluationContext,
  type ProviderMetadata,
  type JsonValue,
  type Logger,
} from "@openfeature/server-sdk";
import Mixpanel from "mixpanel";
import type {
  SelectedVariant,
  LocalFlagsConfig,
  RemoteFlagsConfig,
} from "mixpanel/lib/flags/types";
import {
  type MixpanelFlagsProvider,
  isExpectedType,
  createErrorResolution,
} from "./types";

const FALLBACK_SENTINEL = Symbol("mixpanel-openfeature-fallback");

export class MixpanelProvider implements Provider {
  readonly metadata: ProviderMetadata = { name: "mixpanel-provider" };
  mixpanel?: Mixpanel.Mixpanel;

  private _flagsProvider: MixpanelFlagsProvider;
  private _context: EvaluationContext;
  private _initialized: boolean;

  /**
   * Wrap an existing Mixpanel flags provider (local or remote). The caller
   * owns the underlying Mixpanel instance; `this.mixpanel` remains undefined.
   */
  constructor(flagsProvider: MixpanelFlagsProvider) {
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
   */
  static createLocal(
    token: string,
    config?: LocalFlagsConfig,
  ): MixpanelProvider {
    const mixpanel = Mixpanel.init(token, { local_flags_config: config });
    const flagsProvider = mixpanel.local_flags!;
    flagsProvider.startPollingForDefinitions();
    const provider = new MixpanelProvider(flagsProvider);
    provider.mixpanel = mixpanel;
    return provider;
  }

  /**
   * Create a provider using remote flag evaluation.
   * Initializes a Mixpanel instance configured for server-side flag evaluation.
   */
  static createRemote(
    token: string,
    config?: RemoteFlagsConfig,
  ): MixpanelProvider {
    const mixpanel = Mixpanel.init(token, { remote_flags_config: config });
    const flagsProvider = mixpanel.remote_flags!;
    const provider = new MixpanelProvider(flagsProvider);
    provider.mixpanel = mixpanel;
    return provider;
  }

  /**
   * Capture global evaluation context and await the flags provider's
   * readiness (first successful definitions fetch for local evaluation).
   */
  async initialize(context?: EvaluationContext): Promise<void> {
    if (context && Object.keys(context).length > 0) {
      this._context = context;
    }
    if (typeof this._flagsProvider.areFlagsReady === "function") {
      await this._flagsProvider.areFlagsReady();
    }
    this._initialized = true;
  }

  /** Forward shutdown to the underlying flags provider (stops polling for local). */
  async onClose(): Promise<void> {
    if (typeof this._flagsProvider.shutdown === "function") {
      await this._flagsProvider.shutdown();
    }
  }

  /** Resolve a boolean flag; returns TYPE_MISMATCH if the variant value isn't a boolean. */
  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<boolean>> {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "boolean");
  }

  /** Resolve a string flag; returns TYPE_MISMATCH if the variant value isn't a string. */
  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<string>> {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "string");
  }

  /** Resolve a number flag; returns TYPE_MISMATCH if the variant value isn't a number. */
  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<number>> {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "number");
  }

  /** Resolve a JSON object flag; returns TYPE_MISMATCH if the variant value isn't an object. */
  async resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<T>> {
    return this._resolveTypedFlag(flagKey, defaultValue, context, "object");
  }

  private async _resolveTypedFlag<T>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    expectedType: string,
  ): Promise<ResolutionDetails<T>> {
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

  private _unwrapValue(value: unknown): unknown {
    if (value == null) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item: unknown) => this._unwrapValue(item));
    }

    if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this._unwrapValue(v);
      }
      return result;
    }

    return value;
  }

  private _buildFlagContext(
    evaluationContext: EvaluationContext,
  ): Record<string, unknown> {
    const flagContext: Record<string, unknown> = { ...this._context };
    if (evaluationContext && Object.keys(evaluationContext).length > 0) {
      for (const [key, value] of Object.entries(evaluationContext)) {
        flagContext[key] = this._unwrapValue(value);
      }
    }
    return flagContext;
  }

  private async _resolveFlag<T>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>> {
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
    } as unknown as SelectedVariant;

    const flagContext = this._buildFlagContext(context);

    let variant: SelectedVariant;
    try {
      variant = await this._flagsProvider.getVariant(
        flagKey,
        fallbackVariant,
        flagContext as any,
        true,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return createErrorResolution(
        defaultValue,
        ErrorCode.GENERAL,
        `Flag evaluation failed: ${message}`,
      );
    }

    if ((variant.variant_key as unknown) === FALLBACK_SENTINEL) {
      return {
        value: defaultValue,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        errorMessage: `Flag "${flagKey}" not found`,
        reason: "DEFAULT",
      };
    }

    return {
      value: variant.variant_value as T,
      variant: variant.variant_key ?? undefined,
      reason: "TARGETING_MATCH",
    };
  }
}
