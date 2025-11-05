/**
 * TypeScript type definitions for Mixpanel feature flags
 */

/**
 * Base configuration for feature flags
 */
export interface FlagsConfig {
    /** API host for Mixpanel (default: 'api.mixpanel.com') */
    api_host?: string;
    /** Request timeout in seconds (default: 10) */
    request_timeout_in_seconds?: number;
}

/**
 * Configuration for local feature flags (client-side evaluation)
 */
export interface LocalFlagsConfig extends FlagsConfig {
    /** Enable automatic polling for flag definition updates (default: true) */
    enable_polling?: boolean;
    /** Polling interval in seconds (default: 60) */
    polling_interval_in_seconds?: number;
}

/**
 * Configuration for remote feature flags (server-side evaluation)
 */
export interface RemoteFlagsConfig extends FlagsConfig {}

/**
 * Represents a variant in a feature flag
 */
export interface Variant {
    /** Variant key/name */
    key: string;
    /** Variant value (can be any type) */
    value: any;
    /** Whether this is the control variant */
    is_control: boolean;
    /** Percentage split for this variant (0.0-1.0) */
    split?: number;
}

/**
 * Variant override configuration
 */
export interface VariantOverride {
    /** Key of the variant to override to */
    key: string;
}

/**
 * Rollout configuration for a feature flag
 */
export interface Rollout {
    /** Percentage of users to include in this rollout (0.0-1.0) */
    rollout_percentage: number;
    /** Runtime evaluation conditions (property-based targeting) */
    runtime_evaluation_definition?: Record<string, any>;
    /** Variant override for this rollout */
    variant_override?: VariantOverride;
    /** Variant split percentages (variant_key -> percentage) */
    variant_splits?: Record<string, number>;
}

/**
 * Test users configuration for a feature flag
 */
export interface FlagTestUsers {
    /** Map of distinct_id to variant_key */
    users: Record<string, string>;
}

/**
 * Rule set for a feature flag
 */
export interface RuleSet {
    /** Available variants for this flag */
    variants: Variant[];
    /** Rollout configurations */
    rollout: Rollout[];
    /** Test users configuration */
    test?: FlagTestUsers;
}

/**
 * Complete feature flag definition
 */
export interface ExperimentationFlag {
    /** Flag ID */
    id: string;
    /** Flag name */
    name: string;
    /** Flag key (used for lookups) */
    key: string;
    /** Flag status */
    status: string;
    /** Project ID */
    project_id: number;
    /** Rule set for this flag */
    ruleset: RuleSet;
    /** Context type (e.g., 'user', 'group') */
    context: string;
    /** Associated experiment ID */
    experiment_id?: string;
    /** Whether the associated experiment is active */
    is_experiment_active?: boolean;
    /** Hash salt for variant assignment */
    hash_salt?: string;
}

export interface SelectedVariant {
    variant_key?: string | null;
    variant_value: any;
    experiment_id?: string;
    is_experiment_active?: boolean;
    is_qa_tester?: boolean;
}

export interface RemoteFlagsResponse {
    code: number;
    flags: Record<string, SelectedVariant>;
}

export interface LocalFlagsResponse {
    flags: ExperimentationFlag[];
}

export interface FlagContext {
    distinct_id: string;
    [key: string]: any;
}
