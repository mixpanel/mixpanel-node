# Mixpanel Node.js OpenFeature Provider

[![npm](https://img.shields.io/npm/v/@mixpanel/openfeature-server-provider.svg)](https://www.npmjs.com/package/@mixpanel/openfeature-server-provider)
[![OpenFeature](https://img.shields.io/badge/OpenFeature-compatible-green)](https://openfeature.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/mixpanel/mixpanel-node/blob/master/LICENSE)

An [OpenFeature](https://openfeature.dev/) provider that integrates Mixpanel's feature flags with the OpenFeature Node.js Server SDK. This allows you to use Mixpanel's feature flagging capabilities through OpenFeature's standardized, vendor-agnostic API.

## Overview

This package provides a bridge between Mixpanel's native feature flags implementation and the OpenFeature specification. By using this provider, you can:

- Leverage Mixpanel's powerful feature flag and experimentation platform
- Use OpenFeature's standardized API for flag evaluation
- Easily switch between feature flag providers without changing your application code
- Integrate with OpenFeature's ecosystem of tools and frameworks

## Installation

```bash
npm install @mixpanel/openfeature-server-provider
```

You will also need the OpenFeature Server SDK and Mixpanel Node.js SDK:

```bash
npm install @openfeature/server-sdk mixpanel
```

## Quick Start

```typescript
import { OpenFeature } from "@openfeature/server-sdk";
import { MixpanelProvider } from "@mixpanel/openfeature-server-provider";

// 1. Create and register the provider with local evaluation
const provider = MixpanelProvider.createLocal("YOUR_PROJECT_TOKEN");
await OpenFeature.setProviderAndWait(provider);

// 2. Get a client and evaluate flags
const client = OpenFeature.getClient();
const showNewFeature = await client.getBooleanValue("new-feature-flag", false, {
  distinct_id: "user-123",
});

if (showNewFeature) {
  console.log("New feature is enabled!");
}
```

## Initialization

The provider supports three initialization approaches depending on your evaluation strategy:

### Local Evaluation

Evaluates flags locally using cached flag definitions that are polled from Mixpanel. This is the recommended approach for most server-side applications as it minimizes latency.

```typescript
const provider = MixpanelProvider.createLocal("YOUR_PROJECT_TOKEN");
```

This automatically starts polling for flag definitions in the background.

### Remote Evaluation

Evaluates flags by making a request to Mixpanel's servers for each evaluation. Use this when you need real-time flag values and can tolerate the additional network latency.

```typescript
const provider = MixpanelProvider.createRemote("YOUR_PROJECT_TOKEN");
```

### Using an Existing Mixpanel Instance

If your application already has a Mixpanel instance configured, you can create the provider from its flags provider directly rather than having the provider create a new one:

```typescript
import Mixpanel from "mixpanel";

// Your existing Mixpanel instance
const mixpanel = Mixpanel.init("YOUR_PROJECT_TOKEN", {
  local_flags_config: {},
});
const localFlags = mixpanel.local_flags!;
localFlags.startPollingForDefinitions();

// Wrap the existing flags provider with OpenFeature
const provider = new MixpanelProvider(localFlags);
```

> **Note:** When using this constructor, `provider.mixpanel` will be `undefined` since the provider does not own the Mixpanel instance.

## Usage Examples

### Basic Boolean Flag

```typescript
const client = OpenFeature.getClient();

// Get a boolean flag with a default value
const isFeatureEnabled = await client.getBooleanValue("my-feature", false, {
  distinct_id: "user-123",
});

if (isFeatureEnabled) {
  // Show the new feature
}
```

### Mixpanel Flag Types and OpenFeature Evaluation Methods

Mixpanel feature flags support three flag types. Use the corresponding OpenFeature evaluation method based on your flag's variant values:

| Mixpanel Flag Type | Variant Values                          | OpenFeature Method                                                                 |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------------------------- |
| Feature Gate       | `true` / `false`                        | `getBooleanValue()`                                                                |
| Experiment         | boolean, string, number, or JSON object | `getBooleanValue()`, `getStringValue()`, `getNumberValue()`, or `getObjectValue()` |
| Dynamic Config     | JSON object                             | `getObjectValue()`                                                                 |

```typescript
const client = OpenFeature.getClient();
const context = { distinct_id: "user-123" };

// Feature Gate - boolean variants
const isFeatureOn = await client.getBooleanValue(
  "new-checkout",
  false,
  context,
);

// Experiment with string variants
const buttonColor = await client.getStringValue(
  "button-color-test",
  "blue",
  context,
);

// Experiment with number variants
const maxItems = await client.getNumberValue("max-items", 10, context);

// Dynamic Config - JSON object variants
const featureConfig = await client.getObjectValue(
  "homepage-layout",
  {},
  context,
);
```

### Getting Full Resolution Details

If you need additional metadata about the flag evaluation:

```typescript
const client = OpenFeature.getClient();

const details = await client.getBooleanDetails("my-feature", false, {
  distinct_id: "user-123",
});

console.log(details.value); // The resolved value
console.log(details.variant); // The variant key from Mixpanel
console.log(details.reason); // Why this value was returned
console.log(details.errorCode); // Error code if evaluation failed
```

### Setting Context

You can pass evaluation context that will be sent to Mixpanel for flag evaluation. Context can be set globally during initialization or per-evaluation:

```typescript
// Global context (set during provider initialization)
await OpenFeature.setProviderAndWait(provider);
OpenFeature.setContext({ environment: "production" });

// Per-evaluation context (merged with and overrides global context)
const value = await client.getBooleanValue("premium-feature", false, {
  distinct_id: "user-123",
  email: "user@example.com",
  plan: "premium",
  beta_tester: true,
});
```

### Accessing the Underlying Mixpanel Instance

If you initialized the provider with `createLocal` or `createRemote`, you can access the underlying Mixpanel instance for sending events or profile updates:

```typescript
const mixpanel = provider.mixpanel;
if (mixpanel) {
  mixpanel.track("button_clicked", { distinct_id: "user-123" });
}
```

> **Note:** This is `undefined` if the provider was constructed with a flags provider directly.

### Shutdown

When your application is shutting down, close the OpenFeature API to clean up resources:

```typescript
await OpenFeature.close();
```

## Context Mapping

### All Properties Passed Directly

All properties in the OpenFeature `EvaluationContext` are passed directly to Mixpanel's feature flag evaluation. There is no transformation or filtering of properties.

```typescript
// This OpenFeature context...
const context = {
  distinct_id: "user-123",
  email: "user@example.com",
  plan: "premium",
};

// ...is passed to Mixpanel as-is for flag evaluation
```

### targetingKey is Not Special

Unlike some feature flag providers, `targetingKey` is **not** used as a special bucketing key in Mixpanel. It is simply passed as another context property. Mixpanel's server-side configuration determines which properties are used for targeting rules and bucketing.

## Error Handling

The provider uses OpenFeature's standard error codes to indicate issues during flag evaluation:

### PROVIDER_NOT_READY

Returned when flags are evaluated before the local flags provider has finished loading flag definitions. This only applies when using local evaluation.

```typescript
const details = await client.getBooleanDetails("my-feature", false, context);

if (details.errorCode === "PROVIDER_NOT_READY") {
  console.log("Provider still loading, using default value");
}
```

### FLAG_NOT_FOUND

Returned when the requested flag does not exist in Mixpanel.

```typescript
const details = await client.getBooleanDetails(
  "nonexistent-flag",
  false,
  context,
);

if (details.errorCode === "FLAG_NOT_FOUND") {
  console.log("Flag does not exist, using default value");
}
```

### TYPE_MISMATCH

Returned when the flag value type does not match the requested type.

```typescript
// If 'my-flag' is configured as a string in Mixpanel...
const details = await client.getBooleanDetails("my-flag", false, context);

if (details.errorCode === "TYPE_MISMATCH") {
  console.log("Flag is not a boolean, using default value");
}
```

## Troubleshooting

### Flags Always Return Default Values

**Possible causes:**

1. **Provider not ready (local evaluation):** The local flags provider may still be loading flag definitions. Flag definitions are polled asynchronously after the provider is created. Use `setProviderAndWait()` to ensure flags are ready before evaluation, or check the `PROVIDER_NOT_READY` error code.

2. **Invalid project token:** Verify the token passed to the config matches your Mixpanel project.

3. **Flag not configured:** Verify the flag exists in your Mixpanel project and is enabled.

4. **Network issues:** Check that your application can reach Mixpanel's API servers.

### Type Mismatch Errors

If you are getting `TYPE_MISMATCH` errors:

1. **Check flag configuration:** Verify the flag's value type in Mixpanel matches how you are evaluating it. For example, if the flag value is the string `"true"`, use `getStringValue()`, not `getBooleanValue()`.

2. **Use `getObjectValue()` for complex types:** For JSON objects, use `getObjectValue()`.

### Exposure Events Not Tracking

If `$experiment_started` events are not appearing in Mixpanel:

1. **Verify Mixpanel tracking is working:** Test that other Mixpanel events are being tracked successfully.

2. **Check for duplicate evaluations:** Mixpanel only tracks the first exposure per flag per session to avoid duplicate events.

## Requirements

- Node.js 10 or higher
- `mixpanel` 0.21.0+
- `@openfeature/server-sdk` 1.17.0+

## License

MIT
