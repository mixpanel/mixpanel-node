// grab the Mixpanel factory
const Mixpanel = require("./lib/mixpanel-node");

// create an instance of the mixpanel client
const mixpanel = Mixpanel.init("962dbca1bbc54701d402c94d65b4a20e");
mixpanel.set_config({ debug: true });

// track an event with optional properties
mixpanel.track("my event", {
  distinct_id: "some unique client id",
  as: "many",
  properties: "as",
  you: "want",
});
mixpanel.track("played_game");

// create or update a user in Mixpanel Engage
mixpanel.people.set("billybob", {
  $first_name: "Billy",
  $last_name: "Bob",
  $created: new Date("jan 1 2013").toISOString(),
  plan: "premium",
  games_played: 1,
  points: 0,
});

// create or update a user in Mixpanel Engage without altering $last_seen
// - pass option `$ignore_time: true` to prevent the $last_seen property from being updated
mixpanel.people.set(
  "billybob",
  {
    plan: "premium",
    games_played: 1,
  },
  {
    $ignore_time: true,
  },
);

// set a single property on a user
mixpanel.people.set("billybob", "plan", "free");

// set a single property on a user, don't override
mixpanel.people.set_once(
  "billybob",
  "first_game_play",
  new Date("jan 1 2013").toISOString(),
);

// increment a numeric property
mixpanel.people.increment("billybob", "games_played");

// increment a numeric property by a different amount
mixpanel.people.increment("billybob", "points", 15);

// increment multiple properties
mixpanel.people.increment("billybob", { points: 10, games_played: 1 });

// append value to a list
mixpanel.people.append("billybob", "awards", "Great Player");

// append multiple values to a list
mixpanel.people.append("billybob", {
  awards: "Great Player",
  levels_finished: "Level 4",
});

// record a transaction for revenue analytics
mixpanel.people.track_charge("billybob", 39.99);

// clear a users transaction history
mixpanel.people.clear_charges("billybob");

// delete a user
mixpanel.people.delete_user("billybob");

// all functions that send data to mixpanel take an optional
// callback as the last argument
mixpanel.track("test", function (err) {
  if (err) {
    throw err;
  }
});

// ============================================================================
// Service Account Authentication (RECOMMENDED for importing old events)
// ============================================================================
// Service accounts provide enhanced security for importing historical events
// Learn more: https://developer.mixpanel.com/reference/service-accounts-api

const { ServiceAccountCredentials } = Mixpanel;

const credentials = new ServiceAccountCredentials(
  "YOUR_SERVICE_ACCOUNT_USERNAME", // From Mixpanel project settings
  "YOUR_SERVICE_ACCOUNT_SECRET", // From Mixpanel project settings
  "YOUR_PROJECT_ID", // Your Mixpanel project ID
);

const mixpanel_with_sa = Mixpanel.init("valid mixpanel token", {
  credentials,
});
mixpanel_with_sa.set_config({ debug: true });

// Import old events (uses service account auth)
mixpanel_with_sa.import("old event", new Date(2012, 4, 20, 12, 34, 56), {
  distinct_id: "billybob",
  gender: "male",
});

// Import multiple events at once
mixpanel_with_sa.import_batch([
  {
    event: "old event",
    properties: {
      time: new Date(2012, 4, 20, 12, 34, 56),
      distinct_id: "billybob",
      gender: "male",
    },
  },
  {
    event: "another old event",
    properties: {
      time: new Date(2012, 4, 21, 11, 33, 55),
      distinct_id: "billybob",
      color: "red",
    },
  },
]);

// ============================================================================
// DEPRECATED: API Secret (use Service Accounts instead)
// ============================================================================
// This method still works but will be removed in a future version
const mixpanel_importer = Mixpanel.init("valid mixpanel token", {
  secret: "valid api secret for project", // DEPRECATED - use ServiceAccountCredentials
});
mixpanel_importer.set_config({ debug: true });

mixpanel_importer.import("old event", new Date(2012, 4, 20, 12, 34, 56), {
  distinct_id: "billybob",
  gender: "male",
});
