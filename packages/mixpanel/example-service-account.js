/**
 * Example usage of Service Account authentication with mixpanel-node
 *
 * Service accounts provide enhanced security for server-to-server integrations
 * by using unique username/secret pairs instead of shared API secrets.
 */

const Mixpanel = require("./lib/mixpanel-node");
const { ServiceAccountCredentials } = Mixpanel;

// Create service account credentials
// Replace with your actual service account credentials
const credentials = new ServiceAccountCredentials(
  "YOUR_SERVICE_ACCOUNT_USERNAME",
  "YOUR_SERVICE_ACCOUNT_SECRET",
  "YOUR_PROJECT_ID",
);

// Initialize Mixpanel with service account credentials
const mixpanel = Mixpanel.init("YOUR_PROJECT_TOKEN", {
  credentials,
  test: true, // Set to false in production
  debug: true, // Enable debug logging
});

console.log("Service Account Example");
console.log("=======================\n");

// Example 1: Import an old event
console.log("1. Importing an old event...");
mixpanel.import(
  "old_signup",
  new Date(2020, 0, 1, 10, 30, 0),
  {
    distinct_id: "user123",
    source: "historical_data",
    plan: "premium",
  },
  (err) => {
    if (err) {
      console.error("   Error importing event:", err.message);
    } else {
      console.log("   ✓ Event imported successfully");
    }
  },
);

// Example 2: Import multiple events in a batch
console.log("\n2. Importing a batch of events...");
mixpanel.import_batch(
  [
    {
      event: "page_view",
      properties: {
        time: new Date(2020, 0, 15, 14, 0, 0),
        distinct_id: "user123",
        page: "/home",
      },
    },
    {
      event: "page_view",
      properties: {
        time: new Date(2020, 0, 15, 14, 5, 0),
        distinct_id: "user123",
        page: "/products",
      },
    },
    {
      event: "purchase",
      properties: {
        time: new Date(2020, 0, 15, 14, 10, 0),
        distinct_id: "user123",
        amount: 99.99,
      },
    },
  ],
  (errors) => {
    if (errors) {
      console.error("   Errors importing batch:", errors);
    } else {
      console.log("   ✓ Batch imported successfully");
    }
  },
);

// Example 3: Regular tracking (uses token in payload, no auth needed)
console.log("\n3. Tracking a current event...");
mixpanel.track(
  "button_clicked",
  {
    distinct_id: "user456",
    button_name: "signup",
    page: "/landing",
  },
  (err) => {
    if (err) {
      console.error("   Error tracking event:", err.message);
    } else {
      console.log("   ✓ Event tracked successfully");
    }
  },
);

// Example 4: Using with feature flags
console.log("\n4. Service accounts can also be used with feature flags");
console.log("   (requires local_flags_config or remote_flags_config)");

console.log("\nNotes:");
console.log(
  "- Service account auth is only used for /import endpoint and feature flags",
);
console.log(
  "- Regular tracking (/track, /engage, /groups) uses token in payload only",
);
console.log("- HTTPS is required when using service account credentials");
console.log("- This example uses test mode - set test: false in production");
