/**
 * TypeScript definitions for Local Feature Flags Provider
 */

import { LocalFlagsConfig, FlagContext, SelectedVariant } from "./types";
import { CustomLogger } from "../mixpanel-node";

/**
 * Local Feature Flags Provider
 * Evaluates feature flags client-side using locally cached definitions
 */
export default class LocalFeatureFlagsProvider {
  constructor(
    token: string,
    config: LocalFlagsConfig,
    tracker: (
      distinct_id: string,
      event: string,
      properties: object,
      callback: (err?: Error) => void,
    ) => void,
    logger: CustomLogger,
  );

  /**
   * Start polling for flag definitions
   * Fetches immediately and then at regular intervals if polling is enabled
   */
  startPollingForDefinitions(): Promise<void>;

  /**
   * Stop polling for flag definitions
   */
  stopPollingForDefinitions(): void;

  /**
   * Get the variant value for a feature flag
   * @param flagKey - Feature flag key
   * @param fallbackValue - Value to return if flag evaluation fails
   * @param context - Evaluation context (must include distinct_id)
   * @param reportExposure - Whether to track exposure event (default: true)
   */
  getVariantValue<T>(
    flagKey: string,
    fallbackValue: T,
    context: FlagContext,
    reportExposure?: boolean,
  ): T;

  /**
   * Get the complete variant information for a feature flag
   * @param flagKey - Feature flag key
   * @param fallbackVariant - Variant to return if flag evaluation fails
   * @param context - Evaluation context (must include distinct_id)
   * @param reportExposure - Whether to track exposure event (default: true)
   */
  getVariant(
    flagKey: string,
    fallbackVariant: SelectedVariant,
    context: FlagContext,
    reportExposure?: boolean,
  ): SelectedVariant;

  /**
   * Check if a feature flag is enabled
   * This method is intended only for flags defined as Mixpanel Feature Gates (boolean flags)
   * This checks that the variant value of a selected variant is concretely the boolean 'true'
   * It does not coerce other truthy values.
   * @param flagKey - Feature flag key
   * @param context - Evaluation context (must include distinct_id)
   */
  isEnabled(flagKey: string, context: FlagContext): boolean;

  /**
   * Get all feature flag variants for the current user context
   * Exposure events are not automatically tracked when this method is used
   * @param context - Evaluation context (must include distinct_id)
   */
  getAllVariants(context: FlagContext): { [key: string]: SelectedVariant };
}
