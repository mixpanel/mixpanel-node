/**
 * TypeScript definitions for Remote Feature Flags Provider
 */

import { CustomLogger } from "../mixpanel-node";
import { RemoteFlagsConfig, FlagContext, SelectedVariant } from "./types";

/**
 * Remote Feature Flags Provider
 * Evaluates feature flags via server-side API requests
 */
export default class RemoteFeatureFlagsProvider {
  constructor(
    token: string,
    config: RemoteFlagsConfig,
    logger: CustomLogger,
    tracker: (
      distinct_id: string,
      event: string,
      properties: object,
      callback: (err?: Error) => void,
    ) => void,
  );

  /**
   * Get the variant value for a feature flag
   * @param flagKey - Feature flag key
   * @param fallbackValue - Value to return if flag evaluation fails
   * @param context - Evaluation context (must include distinct_id)
   * @param reportExposure - Whether to track exposure event (default: true)
   * @returns Promise resolving to variant value
   */
  getVariantValue<T>(
    flagKey: string,
    fallbackValue: T,
    context: FlagContext,
    reportExposure?: boolean,
  ): Promise<T>;

  /**
   * Get the complete variant information for a feature flag
   * @param flagKey - Feature flag key
   * @param fallbackVariant - Variant to return if flag evaluation fails
   * @param context - Evaluation context (must include distinct_id)
   * @param reportExposure - Whether to track exposure event (default: true)
   * @returns Promise resolving to selected variant
   */
  getVariant(
    flagKey: string,
    fallbackVariant: SelectedVariant,
    context: FlagContext,
    reportExposure?: boolean,
  ): Promise<SelectedVariant>;

  /**
   * Check if a feature flag is enabled.
   * This checks that the variant value of a selected variant is concretely the boolean 'true', which will be the case for flags setup as FeatureGates
   * It does not coerce other truthy values.
   * @param flagKey - Feature flag key
   * @param context - Evaluation context (must include distinct_id)
   * @returns Promise resolving to whether the flag is enabled
   */
  isEnabled(flagKey: string, context: FlagContext): Promise<boolean>;

  /**
   * Get all feature flag variants for the current user context from remote server
   * Exposure events are not automatically tracked when this method is used
   * @param context - Evaluation context (must include distinct_id)
   * @returns Promise resolving to dictionary mapping flag keys to variants, or null if the call fails
   */
  getAllVariants(
    context: FlagContext,
  ): Promise<{ [key: string]: SelectedVariant } | null>;
}
