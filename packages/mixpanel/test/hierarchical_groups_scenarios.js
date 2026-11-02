const Mixpanel = require("../lib/mixpanel-node");
const packageInfo = require("../package.json");
const {
  MixpanelIdentity,
  MixpanelArgumentError,
  MixpanelUnsupportedOperationError,
  MixpanelCompanyRequiredError,
} = Mixpanel;

const TOKEN = "token";
const USER_ID = "my_user_id";
const COMPANY_ID = "my_company_id";
const TEAM_ID = "my_team_id";
const DEVICE_ID = "my_device_id";

const identity = (ids) => new MixpanelIdentity(ids);
const user = () => identity({ user_id: USER_ID, company_id: COMPANY_ID });
const COMBINED_DISTINCT_ID = `$company:${COMPANY_ID}|$user:${USER_ID}`;

// keys the SDK adds to every event
const EVENT_KEYS = ["token", "mp_lib", "$lib_version"];

describe("hierarchical groups scenarios", () => {
  let hg, legacy;
  beforeEach(() => {
    hg = Mixpanel.init(TOKEN, { hierarchical_groups: true });
    legacy = Mixpanel.init(TOKEN);
    vi.spyOn(hg, "send_request").mockImplementation(() => {});
    vi.spyOn(legacy, "send_request").mockImplementation(() => {});
  });

  // the single request sent by the call
  const sent = (client) => {
    expect(client.send_request).toHaveBeenCalledTimes(1);
    return client.send_request.mock.calls[0][0];
  };

  const expect_event = (client, endpoint, event, properties, extra_keys) => {
    const request = sent(client);
    expect(request.endpoint).toBe(endpoint);
    expect(request.data.event).toBe(event);
    expect(Object.keys(request.data).sort()).toEqual(["event", "properties"]);
    expect(Object.keys(request.data.properties).sort()).toEqual(
      [...EVENT_KEYS, ...(extra_keys || []), ...Object.keys(properties)].sort(),
    );
    expect(request.data.properties).toMatchObject({
      ...properties,
      token: TOKEN,
      mp_lib: "node",
      $lib_version: packageInfo.version,
    });
    return request.data.properties;
  };

  // a /groups request with exactly $token, the group, $company_id and one operation
  const expect_group_update = (client, group_key, group_id, operation) => {
    const request = sent(client);
    expect(request.endpoint).toBe("/groups");
    expect(Object.keys(request.data).sort()).toEqual(
      [
        "$token",
        "$group_key",
        "$group_id",
        "$company_id",
        ...Object.keys(operation),
      ].sort(),
    );
    expect(request.data).toEqual({
      $token: TOKEN,
      $group_key: group_key,
      $group_id: group_id,
      $company_id: COMPANY_ID,
      ...operation,
    });
  };
  const expect_user_update = (client, operation) =>
    expect_group_update(client, "$user_id", USER_ID, operation);
  const expect_company_update = (client, operation) =>
    expect_group_update(client, "$company_id", COMPANY_ID, operation);
  const expect_custom_group_update = (client, operation) =>
    expect_group_update(client, "team_id", TEAM_ID, operation);

  const expect_rejected = (client, call, error_type) => {
    expect(call).toThrow(error_type);
    expect(client.send_request).not.toHaveBeenCalled();
  };

  describe("events", () => {
    it("Track Anonymous", () => {
      hg.track(identity({ device_id: DEVICE_ID }), "Page View");

      const properties = expect_event(hg, "/track", "Page View", {
        $device_id: DEVICE_ID,
      });
      expect(properties).not.toHaveProperty("$user_id");
      expect(properties).not.toHaveProperty("$company_id");
    });

    it("Track Identified", () => {
      hg.track(
        identity({
          user_id: USER_ID,
          company_id: COMPANY_ID,
          device_id: DEVICE_ID,
        }),
        "Page View",
      );

      const properties = expect_event(hg, "/track", "Page View", {
        $user_id: USER_ID,
        $company_id: COMPANY_ID,
        $device_id: DEVICE_ID,
      });
      expect(properties).not.toHaveProperty("distinct_id");
    });

    it("Track Identified Without Device", () => {
      hg.track(user(), "Page View");

      const properties = expect_event(hg, "/track", "Page View", {
        $user_id: USER_ID,
        $company_id: COMPANY_ID,
      });
      expect(properties).not.toHaveProperty("$device_id");
    });

    it("Track With Custom Group", () => {
      hg.track(user(), "Page View", { team_id: TEAM_ID });

      expect_event(hg, "/track", "Page View", {
        $user_id: USER_ID,
        $company_id: COMPANY_ID,
        team_id: TEAM_ID,
      });
    });

    it("Import Identified", () => {
      hg.import(
        identity({
          user_id: USER_ID,
          company_id: COMPANY_ID,
          device_id: DEVICE_ID,
        }),
        "Page View",
        1700000000000,
      );

      const properties = expect_event(
        hg,
        "/import",
        "Page View",
        { $user_id: USER_ID, $company_id: COMPANY_ID, $device_id: DEVICE_ID },
        ["time"],
      );
      expect(properties.time).toBe(1700000000000);
    });

    it("Identity Overrides Properties", () => {
      hg.track(user(), "Page View", {
        $user_id: "other_user",
        $company_id: "other_company",
        plan: "pro",
      });

      expect_event(hg, "/track", "Page View", {
        $user_id: USER_ID,
        $company_id: COMPANY_ID,
        plan: "pro",
      });
    });

    it("Track With Combined Distinct ID", () => {
      hg.track("Page View", { distinct_id: COMBINED_DISTINCT_ID });

      expect_event(hg, "/track", "Page View", {
        distinct_id: COMBINED_DISTINCT_ID,
      });
    });

    it("Track With Combined Distinct ID Identity", () => {
      hg.track(identity({ distinct_id: COMBINED_DISTINCT_ID }), "Page View");

      expect_event(hg, "/track", "Page View", {
        distinct_id: COMBINED_DISTINCT_ID,
      });
    });
  });

  describe("user profile", () => {
    it("Set User Property", () => {
      hg.people.set(user(), "plan", "pro");

      expect_user_update(hg, { $set: { plan: "pro" } });
    });

    it("Set User Property With Combined Distinct ID", () => {
      hg.people.set(COMBINED_DISTINCT_ID, "plan", "pro");

      expect_user_update(hg, { $set: { plan: "pro" } });
    });

    it("Set User Property With Combined Distinct ID Identity", () => {
      hg.people.set(
        identity({ distinct_id: COMBINED_DISTINCT_ID }),
        "plan",
        "pro",
      );

      expect_user_update(hg, { $set: { plan: "pro" } });
    });

    it("Set User Property With Distinct ID (Unsupported)", () => {
      expect_rejected(
        hg,
        () => hg.people.set(USER_ID, "plan", "pro"),
        MixpanelArgumentError,
      );
    });

    it("Set User Properties", () => {
      hg.people.set(user(), { plan: "pro", role: "admin" });

      expect_user_update(hg, { $set: { plan: "pro", role: "admin" } });
    });

    it("Set Once User Property", () => {
      hg.people.set_once(user(), "first_seen", "today");

      expect_user_update(hg, { $set_once: { first_seen: "today" } });
    });

    it("Union User Property", () => {
      hg.people.union(user(), { tags: ["a", "b"] });

      expect_user_update(hg, { $union: { tags: ["a", "b"] } });
    });

    it("Remove User Property", () => {
      hg.people.remove(user(), { tags: "a" });

      expect_user_update(hg, { $remove: { tags: "a" } });
    });

    it("Unset User Property", () => {
      hg.people.unset(user(), "plan");

      expect_user_update(hg, { $unset: ["plan"] });
    });

    it("Delete User", () => {
      hg.people.delete_user(user());

      expect_user_update(hg, { $delete: "" });
    });

    it("Clear Charges (Unsupported)", () => {
      expect_rejected(
        hg,
        () => hg.people.clear_charges(user()),
        MixpanelUnsupportedOperationError,
      );
      expect_rejected(
        hg,
        () => hg.people.clear_charges(COMBINED_DISTINCT_ID),
        MixpanelUnsupportedOperationError,
      );
    });

    it("Increment User Property (Unsupported)", () => {
      expect_rejected(
        hg,
        () => hg.people.increment(user(), "count", 1),
        MixpanelUnsupportedOperationError,
      );
    });

    it("Append User Property (Unsupported)", () => {
      expect_rejected(
        hg,
        () => hg.people.append(user(), "tags", "a"),
        MixpanelUnsupportedOperationError,
      );
    });

    it("Track Charge (Unsupported)", () => {
      expect_rejected(
        hg,
        () => hg.people.track_charge(user(), 10),
        MixpanelUnsupportedOperationError,
      );
    });
  });

  describe("company", () => {
    let company;
    beforeEach(() => {
      company = hg.for_company(COMPANY_ID);
    });

    it("Set Company Property", () => {
      company.groups.set("$company_id", COMPANY_ID, "tier", "enterprise");

      expect_company_update(hg, { $set: { tier: "enterprise" } });
    });

    it("Set Company Properties", () => {
      company.groups.set("$company_id", COMPANY_ID, {
        tier: "enterprise",
        seats: 100,
      });

      expect_company_update(hg, { $set: { tier: "enterprise", seats: 100 } });
    });

    it("Set Once Company Property", () => {
      company.groups.set_once("$company_id", COMPANY_ID, "founded", "2020");

      expect_company_update(hg, { $set_once: { founded: "2020" } });
    });

    it("Union Company Property", () => {
      company.groups.union("$company_id", COMPANY_ID, { regions: ["us"] });

      expect_company_update(hg, { $union: { regions: ["us"] } });
    });

    it("Remove Company Property", () => {
      company.groups.remove("$company_id", COMPANY_ID, { regions: "us" });

      expect_company_update(hg, { $remove: { regions: "us" } });
    });

    it("Unset Company Property", () => {
      company.groups.unset("$company_id", COMPANY_ID, "tier");

      expect_company_update(hg, { $unset: ["tier"] });
    });
  });

  describe("custom groups", () => {
    let company;
    beforeEach(() => {
      company = hg.for_company(COMPANY_ID);
    });

    it("Set User's Custom Group", () => {
      company.people.set(user(), "team_id", TEAM_ID);

      expect_user_update(hg, { $set: { team_id: TEAM_ID } });
    });

    it("Remove User's Custom Group", () => {
      company.people.unset(user(), "team_id");

      expect_user_update(hg, { $unset: ["team_id"] });
    });

    it("Set Custom Group Property", () => {
      company.groups.set("team_id", TEAM_ID, "name", "Platform");

      expect_custom_group_update(hg, { $set: { name: "Platform" } });
    });

    it("Set Custom Group Properties", () => {
      company.groups.set("team_id", TEAM_ID, { name: "Platform", size: 8 });

      expect_custom_group_update(hg, { $set: { name: "Platform", size: 8 } });
    });

    it("Set Once Custom Group Property", () => {
      company.groups.set_once("team_id", TEAM_ID, "created", "2024");

      expect_custom_group_update(hg, { $set_once: { created: "2024" } });
    });

    it("Union Custom Group Property", () => {
      company.groups.union("team_id", TEAM_ID, { skills: ["go"] });

      expect_custom_group_update(hg, { $union: { skills: ["go"] } });
    });

    it("Remove Custom Group Property", () => {
      company.groups.remove("team_id", TEAM_ID, { skills: "go" });

      expect_custom_group_update(hg, { $remove: { skills: "go" } });
    });

    it("Unset Custom Group Property", () => {
      company.groups.unset("team_id", TEAM_ID, "name");

      expect_custom_group_update(hg, { $unset: ["name"] });
    });

    it("Delete Company", () => {
      company.groups.delete_group("$company_id", COMPANY_ID);

      expect_company_update(hg, { $delete: "" });
    });

    it("Delete Custom Group", () => {
      company.groups.delete_group("team_id", TEAM_ID);

      expect_custom_group_update(hg, { $delete: "" });
    });
  });

  describe("unsupported", () => {
    it("Identify Without Company", () => {
      const user_only = identity({ user_id: USER_ID });

      expect_rejected(
        hg,
        () => hg.people.set(user_only, "plan", "pro"),
        MixpanelArgumentError,
      );
      expect_rejected(
        hg,
        () => hg.track(user_only, "Page View"),
        MixpanelArgumentError,
      );
    });

    it("Set User Property Without User", () => {
      expect_rejected(
        hg,
        () =>
          hg.people.set(identity({ company_id: COMPANY_ID }), "plan", "pro"),
        MixpanelArgumentError,
      );
    });

    it("Set Company Property Without Company", () => {
      expect_rejected(
        hg,
        () => hg.groups.set("$company_id", COMPANY_ID, "tier", "enterprise"),
        MixpanelCompanyRequiredError,
      );
    });

    it("Set Custom Group Property Without Company", () => {
      expect_rejected(
        hg,
        () => hg.groups.set("team_id", TEAM_ID, "name", "Platform"),
        MixpanelCompanyRequiredError,
      );
    });

    it("Company Identity Without Hierarchical Groups", () => {
      expect_rejected(
        legacy,
        () => legacy.track(user(), "Page View"),
        MixpanelArgumentError,
      );
      expect_rejected(
        legacy,
        () => legacy.people.set(user(), "plan", "pro"),
        MixpanelArgumentError,
      );
    });

    it("Alias (Unsupported)", () => {
      // A user is identified by company and user id, so there is nothing to alias
      expect(() => hg.alias("old_id", "new_id")).toThrow(
        MixpanelUnsupportedOperationError,
      );
      expect(hg.send_request).not.toHaveBeenCalled();
    });
  });

  describe("without hierarchical groups", () => {
    it("Track With Distinct ID", () => {
      legacy.track("Page View", { distinct_id: USER_ID });

      expect_event(legacy, "/track", "Page View", { distinct_id: USER_ID });
    });

    it("Set User Property With Distinct ID", () => {
      legacy.people.set(USER_ID, "plan", "pro");

      expect(sent(legacy)).toEqual({
        method: "GET",
        endpoint: "/engage",
        data: {
          $token: TOKEN,
          $distinct_id: USER_ID,
          $set: { plan: "pro" },
        },
      });
    });

    it("Set Group Property", () => {
      legacy.groups.set("team_id", TEAM_ID, "name", "Platform");

      expect(sent(legacy)).toEqual({
        method: "GET",
        endpoint: "/groups",
        data: {
          $token: TOKEN,
          $group_key: "team_id",
          $group_id: TEAM_ID,
          $set: { name: "Platform" },
        },
      });
    });
  });
});
