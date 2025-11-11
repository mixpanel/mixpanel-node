/**
 * TypeScript type definitions for Base Feature Flags Provider
 */

import { CustomLogger } from '../mixpanel-node';

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
    constructor(config: FeatureFlagsConfig, endpoint: string, logger: CustomLogger | null);

    /**
     * Common HTTP request handler for flags API endpoints
     * @param additionalParams - Additional query parameters to append
     * @returns Parsed JSON response
     */
    callFlagsEndpoint(additionalParams?: Record<string, any> | null): Promise<any>;
}
