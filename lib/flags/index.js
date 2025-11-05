/**
 * Mixpanel Feature Flags
 * Exports for local and remote feature flag evaluation
 */

const LocalFeatureFlagsProvider = require('./local_flags');
const RemoteFeatureFlagsProvider = require('./remote_flags');

module.exports = {
    LocalFeatureFlagsProvider,
    RemoteFeatureFlagsProvider,
};
