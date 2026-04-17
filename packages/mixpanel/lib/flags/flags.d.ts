/**
 * TypeScript type definitions for Base Feature Flags Provider
 */

import { CustomLogger } from "../mixpanel-node";
import { SelectedVariant, FlagContext } from "./types";

/**
 * Configuration for feature flags API requests
 */
export interface FeatureFlagsConfig {
  token: string;
  api_host: string;
  request_timeout_in_seconds: number;
}

/**
 * Base Feature Flags Provider
 * Contains common methods for feature flag evaluation
 */
export class FeatureFlagsProvider {
  providerConfig: FeatureFlagsConfig;
  endpoint: string;
  logger: CustomLogger | null;

  /**
   * @param config - Common configuration for feature flag providers
   * @param endpoint - API endpoint path (i.e., '/flags' or '/flags/definitions')
   * @param logger - Logger instance
   */
  constructor(
    config: FeatureFlagsConfig,
    endpoint: string,
    logger: CustomLogger | null,
  );

  /**
   * Common HTTP request handler for flags API endpoints
   * @param additionalParams - Additional query parameters to append
   * @returns Parsed JSON response
   */
  callFlagsEndpoint(
    additionalParams?: Record<string, any> | null,
  ): Promise<any>;

  /**
   * Manually tracks a feature flag exposure event to Mixpanel
   * This provides flexibility for reporting individual exposure events when using getAllVariants
   * If using getVariantValue or getVariant, exposure events are tracked automatically by default.
   * @param {string} flagKey - The key of the feature flag
   * @param {SelectedVariant} variant - The selected variant for the feature flag
   * @param {FlagContext} context - The user context used to evaluate the feature flag
   * @param {number|null} latencyMs - Optionally included latency in milliseconds that assignment took.
   */
  trackExposureEvent(
    flagKey: string,
    variant: SelectedVariant,
    context: FlagContext,
    latencyMs?: number | null,
  ): void;
}
