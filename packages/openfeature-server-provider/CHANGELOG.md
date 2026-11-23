# Changelog

## [openfeature/v0.3.0](https://github.com/mixpanel/mixpanel-node/tree/openfeature/v0.3.0) (2026-11-23)

### Features
- tag OpenFeature exposures with $openfeature_provider (SDK-448) ([#298](https://github.com/mixpanel/mixpanel-node/pull/298))
- Implement semver and date custom ops for flags runtime props ([#291](https://github.com/mixpanel/mixpanel-node/pull/291))

[Full Changelog](https://github.com/mixpanel/mixpanel-node/compare/openfeature/v0.2.0...openfeature/v0.3.0)

## [openfeature/v0.2.0](https://github.com/mixpanel/mixpanel-node/tree/openfeature/v0.2.0) (2026-07-29)

### Fixes
- distinguish fallback causes instead of collapsing them to `FLAG_NOT_FOUND`; no-rollout-match now resolves as `reason: DEFAULT` with no error code, and backend error messages are forwarded to `ResolutionDetails.errorMessage` ([#277](https://github.com/mixpanel/mixpanel-node/pull/277))

### Chores
- pin mixpanel ^0.23.0 for fallback_reason (SDK-126) ([#284](https://github.com/mixpanel/mixpanel-node/pull/284))
