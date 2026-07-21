/**
 * Mixpanel Feature Flags
 * Exports for local and remote feature flag evaluation
 */

const LocalFeatureFlagsProvider = require("./local_flags");
const RemoteFeatureFlagsProvider = require("./remote_flags");
const {
  VariantSource,
  FallbackReason,
  withSource,
  asFallback,
} = require("./variant_source");

module.exports = {
  LocalFeatureFlagsProvider,
  RemoteFeatureFlagsProvider,
  VariantSource,
  FallbackReason,
  withSource,
  asFallback,
};
