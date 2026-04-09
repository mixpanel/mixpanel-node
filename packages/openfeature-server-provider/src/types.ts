import type { ResolutionDetails, ErrorCode } from "@openfeature/server-sdk";
import type {
  SelectedVariant,
  FlagContext,
} from "mixpanel/lib/flags/types";

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

export function isExpectedType(
  value: unknown,
  expectedType: string,
): boolean {
  if (expectedType === "object") {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  return typeof value === expectedType;
}

export function createErrorResolution<T>(
  defaultValue: T,
  errorCode: ErrorCode,
  errorMessage: string,
): ResolutionDetails<T> {
  return {
    value: defaultValue,
    errorCode,
    errorMessage,
    reason: "ERROR",
  };
}
