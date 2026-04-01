import type {
  Provider,
  ResolutionDetails,
  EvaluationContext,
  ProviderMetadata,
  JsonValue,
  Logger,
} from "@openfeature/server-sdk";
import type { SelectedVariant, FlagContext } from "../../lib/flags/types";

export interface MixpanelFlagsProvider {
  getVariant(
    flagKey: string,
    fallbackVariant: SelectedVariant,
    context: FlagContext,
    reportExposure?: boolean,
  ): SelectedVariant | Promise<SelectedVariant>;
  shutdown?(): void | Promise<void>;
  areFlagsReady?(): boolean;
}

export class MixpanelProvider implements Provider {
  readonly metadata: ProviderMetadata;

  constructor(flagsProvider: MixpanelFlagsProvider);

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
