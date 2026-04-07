import type {
  Provider,
  ResolutionDetails,
  EvaluationContext,
  ProviderMetadata,
  JsonValue,
  Logger,
} from "@openfeature/server-sdk";
import type {
  SelectedVariant,
  FlagContext,
  LocalFlagsConfig,
  RemoteFlagsConfig,
} from "../../lib/flags/types";
import type mixpanel from "../../lib/mixpanel-node";

export interface MixpanelFlagsProvider {
  getVariant(
    flagKey: string,
    fallbackVariant: SelectedVariant,
    context: FlagContext,
    reportExposure?: boolean,
  ): SelectedVariant | Promise<SelectedVariant>;
  shutdown?(): void | Promise<void>;
  areFlagsReady?(): Promise<void>;
}

export class MixpanelProvider implements Provider {
  readonly metadata: ProviderMetadata;
  mixpanel?: mixpanel.Mixpanel;

  constructor(flagsProvider: MixpanelFlagsProvider);

  static createLocal(
    token: string,
    config?: LocalFlagsConfig,
  ): MixpanelProvider;
  static createRemote(
    token: string,
    config?: RemoteFlagsConfig,
  ): MixpanelProvider;

  initialize(context?: EvaluationContext): Promise<void>;
  onClose(): Promise<void>;

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<boolean>>;

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<string>>;

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<number>>;

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<T>>;
}
