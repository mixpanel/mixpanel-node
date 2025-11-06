/**
 * TypeScript definitions for Local Feature Flags Provider
 */

import { LocalFlagsConfig, FlagContext, SelectedVariant } from './types';
import { CustomLogger } from '../mixpanel-node';

/**
 * Local Feature Flags Provider
 * Evaluates feature flags client-side using locally cached definitions
 */
export default class LocalFeatureFlagsProvider {
    constructor(
        token: string,
        config: LocalFlagsConfig,
        tracker: (distinct_id: string, event: string, properties: object, callback: (err?: Error) => void) => void,
        logger: CustomLogger
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
        reportExposure?: boolean
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
        reportExposure?: boolean
    ): SelectedVariant;

    /**
     * Check if a feature flag is enabled
     * @param flagKey - Feature flag key
     * @param context - Evaluation context (must include distinct_id)
     */
    isEnabled(
        flagKey: string,
        context: FlagContext
    ): boolean;

    /**
     * Get all feature flag variants for the current user context
     * Exposure events are not automatically tracked when this method is used
     * @param context - Evaluation context (must include distinct_id)
     */
    getAllVariants(
        context: FlagContext
    ): {[key: string]: SelectedVariant};

    /**
     * Manually tracks a feature flag exposure event to Mixpanel
     * This provides flexibility for reporting individual exposure events when using getAllVariants
     * @param flagKey - The key of the feature flag
     * @param variant - The selected variant for the feature flag
     * @param context - The user context used to evaluate the feature flag
     */
    trackExposureEvent(
        flagKey: string,
        variant: SelectedVariant,
        context: FlagContext
    ): void;
}
