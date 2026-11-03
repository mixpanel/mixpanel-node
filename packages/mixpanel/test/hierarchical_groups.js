const Mixpanel = require("../lib/mixpanel-node");
const {
  MixpanelIdentity,
  MixpanelArgumentError,
  MixpanelUnsupportedOperationError,
  MixpanelCompanyRequiredError,
} = Mixpanel;

const token = "token";
const combined_id = "$company:acme|$user:user_123";

const identity = (ids) => new MixpanelIdentity(ids);
const hg_user = () => identity({ user_id: "user_123", company_id: "acme" });

describe("hierarchical groups", () => {
  let hg, legacy;
  beforeEach(() => {
    hg = Mixpanel.init(token, { hierarchical_groups: true });
    legacy = Mixpanel.init(token);
    vi.spyOn(hg, "send_request").mockImplementation(() => {});
    vi.spyOn(legacy, "send_request").mockImplementation(() => {});
  });

  // the single request sent by the call
  const sent = (client) => {
    expect(client.send_request).toHaveBeenCalledTimes(1);
    return client.send_request.mock.calls[0][0];
  };
  const event_properties = (client) => sent(client).data.properties;

  describe("MixpanelIdentity", () => {
    it("rejects empty values", () => {
      // An empty string is a caller error; null simply leaves the value unset.
      for (const key of ["distinct_id", "user_id", "company_id", "device_id"]) {
        expect(() => identity({ [key]: "" })).toThrow(MixpanelArgumentError);
      }
    });

    it("rejects non-string values and unknown keys", () => {
      expect(() => identity({ user_id: 123 })).toThrow(MixpanelArgumentError);
      expect(() => identity({ userId: "user_123" })).toThrow(/Unknown/);
      expect(() => new MixpanelIdentity()).toThrow(MixpanelArgumentError);
      expect(() => new MixpanelIdentity("user_123")).toThrow(
        MixpanelArgumentError,
      );
    });

    it("needs at least one value", () => {
      expect(() => identity({})).toThrow(MixpanelArgumentError);
      expect(() => identity({ user_id: null, company_id: undefined })).toThrow(
        /at least one/,
      );
    });

    it("leaves a null value unset", () => {
      const id = identity({ user_id: "user_123", device_id: null });

      expect(id.user_id).toBe("user_123");
      expect(id.device_id).toBeNull();
      expect(id.distinct_id).toBeNull();
    });

    it("is frozen", () => {
      const id = hg_user();

      expect(Object.isFrozen(id)).toBe(true);
      expect(() => {
        "use strict";
        id.company_id = "other";
      }).toThrow(TypeError);
      expect(id.company_id).toBe("acme");
    });

    it("is hierarchical when it names a company", () => {
      expect(hg_user().is_hierarchical).toBe(true);
      expect(identity({ distinct_id: "user_123" }).is_hierarchical).toBe(false);
    });

    it("has a readable string form", () => {
      expect(String(hg_user())).toBe(
        "MixpanelIdentity{user_id=user_123, company_id=acme}",
      );
    });
  });

  describe("mode", () => {
    it("defaults to off and is read-only", () => {
      expect(legacy.hierarchical_groups).toBe(false);
      expect(hg.hierarchical_groups).toBe(true);
      expect(() => {
        "use strict";
        hg.hierarchical_groups = false;
      }).toThrow(TypeError);
      expect(hg.hierarchical_groups).toBe(true);
    });

    it("rejects a non-boolean flag", () => {
      expect(() =>
        Mixpanel.init(token, { hierarchical_groups: "yes" }),
      ).toThrow(MixpanelArgumentError);
    });

    it("is read once at init, like the flags configs", () => {
      legacy.set_config({ hierarchical_groups: true });
      hg.set_config({ hierarchical_groups: false });

      expect(legacy.hierarchical_groups).toBe(false);
      expect(hg.hierarchical_groups).toBe(true);
    });

    it("does not change a message that is valid in both modes", () => {
      const calls = (client) => {
        client.track("Signup", { distinct_id: combined_id, plan: "pro" });
        client.import("Signup", 1000, { distinct_id: combined_id });
        client.for_company("acme").groups.unset("department", "finance", "x");
        client.track(identity({ device_id: "device_abc" }), "Page View");
        return client.send_request.mock.calls;
      };

      expect(calls(hg)).toEqual(calls(legacy));
    });

    it("sends a combined distinct id profile update to /engage only without hierarchical groups", () => {
      const calls = (client) => {
        client.people.set(combined_id, { plan: "pro" });
        client.people.union(combined_id, { tags: ["a"] });
        client.people.set(identity({ distinct_id: combined_id }), { a: 1 });
        return client.send_request.mock.calls.map(([options]) => options);
      };

      const legacy_calls = calls(legacy);
      expect(legacy_calls).toHaveLength(3);
      for (const options of legacy_calls) {
        expect(options.endpoint).toBe("/engage");
        expect(options.data.$distinct_id).toBe(combined_id);
      }

      const hg_calls = calls(hg);
      expect(hg_calls).toHaveLength(3);
      hg_calls.forEach((options, i) => {
        expect(options.endpoint).toBe("/groups");
        expect(options.data).not.toHaveProperty("$distinct_id");
        expect(options.data).toMatchObject({
          $group_key: "$user_id",
          $group_id: "user_123",
          $company_id: "acme",
        });
        // the operation is unchanged
        const without = (data, keys) =>
          Object.fromEntries(
            Object.entries(data).filter(([key]) => !keys.includes(key)),
          );
        expect(
          without(options.data, ["$group_key", "$group_id", "$company_id"]),
        ).toEqual(without(legacy_calls[i].data, ["$distinct_id"]));
      });
    });

    it("exports the error types with codes", () => {
      expect(new MixpanelArgumentError("x")).toBeInstanceOf(TypeError);
      expect(new MixpanelArgumentError("x").code).toBe(
        "MIXPANEL_INVALID_ARGUMENT",
      );
      expect(new MixpanelUnsupportedOperationError("x").code).toBe(
        "MIXPANEL_UNSUPPORTED_OPERATION",
      );
      expect(new MixpanelCompanyRequiredError("x").code).toBe(
        "MIXPANEL_COMPANY_REQUIRED",
      );
      expect(new MixpanelCompanyRequiredError("x").name).toBe(
        "MixpanelCompanyRequiredError",
      );
    });
  });

  describe("events", () => {
    it("sends user and company without a distinct id", () => {
      hg.track(hg_user(), "Signup");

      expect(sent(hg).endpoint).toBe("/track");
      expect(sent(hg).data.event).toBe("Signup");
      const props = event_properties(hg);
      expect(props.$user_id).toBe("user_123");
      expect(props.$company_id).toBe("acme");
      expect(props).not.toHaveProperty("distinct_id");
      expect(props).not.toHaveProperty("$device_id");
      expect(props.token).toBe(token);
    });

    it("sends a device id", () => {
      hg.track(
        identity({ user_id: "user_123", company_id: "acme", device_id: "d" }),
        "Signup",
      );

      expect(event_properties(hg).$device_id).toBe("d");
      expect(event_properties(hg)).not.toHaveProperty("distinct_id");
    });

    it("sends a company-only event", () => {
      hg.track(identity({ company_id: "acme" }), "Renewed");

      const props = event_properties(hg);
      expect(props.$company_id).toBe("acme");
      expect(props).not.toHaveProperty("$user_id");
      expect(props).not.toHaveProperty("distinct_id");
    });

    it("sends a legacy identity as a distinct id", () => {
      legacy.track(identity({ distinct_id: "user_123" }), "Signup");

      const props = event_properties(legacy);
      expect(props.distinct_id).toBe("user_123");
      expect(props).not.toHaveProperty("$user_id");
      expect(props).not.toHaveProperty("$company_id");
    });

    it("overrides caller-supplied identity keys and keeps other properties", () => {
      const caller = { $company_id: "wrong", plan: "enterprise" };

      hg.track(hg_user(), "Signup", caller);

      const props = event_properties(hg);
      expect(props.$company_id).toBe("acme");
      expect(props.plan).toBe("enterprise");
      expect(caller).toEqual({ $company_id: "wrong", plan: "enterprise" });
    });

    it("passes a callback with or without properties", () => {
      const callback = () => {};

      hg.track(hg_user(), "Signup", callback);
      hg.track(hg_user(), "Signup", { plan: "pro" }, callback);
      hg.import(hg_user(), "Signup", 1000, callback);
      hg.import(hg_user(), "Signup", 1000, { plan: "pro" }, callback);

      for (const call of hg.send_request.mock.calls) {
        expect(call[1]).toBe(callback);
        expect(call[0].data.event).toBe("Signup");
      }
      expect(hg.send_request.mock.calls[1][0].data.properties.plan).toBe("pro");
    });

    it("imports a hierarchical event", () => {
      const time = new Date(2020, 1, 1);

      hg.import(hg_user(), "Signup", time);

      expect(sent(hg).endpoint).toBe("/import");
      const props = event_properties(hg);
      expect(props.$user_id).toBe("user_123");
      expect(props.$company_id).toBe("acme");
      expect(props.time).toBe(time.getTime());
      expect(props).not.toHaveProperty("distinct_id");
    });

    it("accepts user and device without a company for simplified id merge", () => {
      // $user_id with $device_id is the standard non-hierarchical server-side identity.
      legacy.track(identity({ user_id: "user_123", device_id: "d" }), "Signup");

      const props = event_properties(legacy);
      expect(props.$user_id).toBe("user_123");
      expect(props.$device_id).toBe("d");
      expect(props).not.toHaveProperty("distinct_id");
      expect(props).not.toHaveProperty("$company_id");
    });

    it("rejects a user without company or device on a hierarchical groups client", () => {
      expect(() =>
        hg.track(identity({ user_id: "user_123" }), "Signup"),
      ).toThrow(/cannot be merged/);
      expect(() =>
        hg.import(identity({ user_id: "user_123" }), "Signup", 1000),
      ).toThrow(MixpanelArgumentError);
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("allows a user with a device but no company on a hierarchical groups client", () => {
      // Mixpanel keeps the event under the device, which later links to the
      // company-scoped user. Recoverable, so the library does not refuse it.
      hg.track(identity({ user_id: "user_123", device_id: "d" }), "Signup");

      expect(event_properties(hg).$device_id).toBe("d");
      expect(event_properties(hg)).not.toHaveProperty("$company_id");
    });

    it("sends an anonymous device event in both modes", () => {
      for (const client of [hg, legacy]) {
        client.track(identity({ device_id: "d" }), "Page View");

        const props = event_properties(client);
        expect(props.$device_id).toBe("d");
        expect(props).not.toHaveProperty("distinct_id");
        expect(props).not.toHaveProperty("$user_id");
        expect(props).not.toHaveProperty("$company_id");
      }
    });

    it("passes a combined distinct id through", () => {
      // Ingestion parses $company:{company}|$user:{user} back into $company_id
      // and $user_id.
      hg.track("Signup", { distinct_id: combined_id });
      hg.track(identity({ distinct_id: combined_id }), "Signup");

      for (const call of hg.send_request.mock.calls) {
        expect(call[0].data.properties.distinct_id).toBe(combined_id);
        expect(call[0].data.properties).not.toHaveProperty("$user_id");
      }
    });

    it("never refuses a raw distinct id", () => {
      hg.track("Signup", { distinct_id: "user_123" });
      hg.import("Signup", 1000, { distinct_id: "user_123" });
      legacy.track("Signup", { distinct_id: "user_123" });

      for (const client of [hg, legacy]) {
        for (const call of client.send_request.mock.calls) {
          expect(call[0].data.properties.distinct_id).toBe("user_123");
        }
      }
    });

    it("requires a hierarchical groups client for a hierarchical identity", () => {
      expect(() => legacy.track(hg_user(), "Signup")).toThrow(
        /requires a hierarchical groups client/,
      );
      expect(() => legacy.import(hg_user(), "Signup", 1000)).toThrow(
        MixpanelArgumentError,
      );
      expect(() =>
        legacy.track(identity({ company_id: "acme" }), "Renewed"),
      ).toThrow(MixpanelArgumentError);
      expect(legacy.send_request).not.toHaveBeenCalled();
    });
  });

  describe("alias", () => {
    it("refuses alias on a hierarchical groups client", () => {
      expect(() =>
        hg.alias("$company:acme|$user:user_123", "$company:acme|$user:u2"),
      ).toThrow(MixpanelUnsupportedOperationError);
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("still sends $create_alias on other clients", () => {
      legacy.alias("user_123", "u2");
      expect(sent(legacy).data.event).toBe("$create_alias");
    });
  });

  describe("user profiles", () => {
    it("refuses $add and $append on a hierarchical groups client", () => {
      // A hierarchical groups user profile is a group profile, and /groups has
      // no $add or $append, so these have no valid path at all.
      expect(() => hg.people.increment("user_123", { logins: 1 })).toThrow(
        MixpanelUnsupportedOperationError,
      );
      expect(() => hg.people.increment("user_123", "logins")).toThrow(
        MixpanelUnsupportedOperationError,
      );
      expect(() => hg.people.append("user_123", { tags: "a" })).toThrow(
        MixpanelUnsupportedOperationError,
      );
      expect(() => hg.people.track_charge("user_123", 9.99)).toThrow(
        MixpanelUnsupportedOperationError,
      );
      expect(() => hg.people.increment(hg_user(), "logins")).toThrow(
        MixpanelUnsupportedOperationError,
      );
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("names what is supported when refusing an operation", () => {
      let error;
      try {
        hg.people.increment("user_123", { logins: 1 });
      } catch (e) {
        error = e;
      }

      expect(error.message).toContain("$add");
      expect(error.message).toContain(
        "people.increment, people.append, people.track_charge and people.clear_charges",
      );
      expect(error.message).toContain("$set_once");
    });

    it("rejects an identity in increment, append, track_charge and clear_charges", () => {
      const id = identity({ distinct_id: "user_123" });

      expect(() => legacy.people.increment(id, "logins")).toThrow(
        MixpanelArgumentError,
      );
      expect(() => legacy.people.append(id, "tags", "a")).toThrow(
        MixpanelArgumentError,
      );
      expect(() => legacy.people.track_charge(id, 9.99)).toThrow(
        MixpanelArgumentError,
      );
      expect(() => legacy.people.clear_charges(id)).toThrow(
        MixpanelArgumentError,
      );
      expect(legacy.send_request).not.toHaveBeenCalled();
    });

    it("refuses clear_charges on a hierarchical groups client", () => {
      expect(() => hg.people.clear_charges(combined_id)).toThrow(
        MixpanelUnsupportedOperationError,
      );
      expect(() => hg.people.clear_charges("user_123")).toThrow(
        /people\.clear_charges is not supported/,
      );
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("sends supported people methods with a combined distinct id to /groups", () => {
      hg.people.set(combined_id, { plan: "pro" });
      hg.people.set_once(combined_id, { plan: "pro" });
      hg.people.delete_user(combined_id);
      hg.people.remove(combined_id, { tags: "a" });
      hg.people.union(combined_id, { tags: ["a"] });
      hg.people.unset(combined_id, ["plan"]);

      const operations = [
        "$set",
        "$set_once",
        "$delete",
        "$remove",
        "$union",
        "$unset",
      ];
      const calls = hg.send_request.mock.calls;
      expect(calls).toHaveLength(operations.length);
      calls.forEach(([options], i) => {
        expect(options.endpoint).toBe("/groups");
        expect(Object.keys(options.data).sort()).toEqual(
          [
            "$token",
            "$group_key",
            "$group_id",
            "$company_id",
            operations[i],
          ].sort(),
        );
        expect(options.data).toMatchObject({
          $token: token,
          $group_key: "$user_id",
          $group_id: "user_123",
          $company_id: "acme",
        });
      });
    });

    it("rejects any other distinct id in a profile update and sends nothing", () => {
      for (const distinct_id of ["user_123", "", undefined, 42]) {
        expect(() => hg.people.set(distinct_id, { plan: "pro" })).toThrow(
          MixpanelArgumentError,
        );
        expect(() => hg.people.delete_user(distinct_id)).toThrow(
          MixpanelArgumentError,
        );
      }
      expect(() => hg.people.set_once("user_123", "a", 1)).toThrow(
        MixpanelArgumentError,
      );
      expect(() => hg.people.remove("user_123", { tags: "a" })).toThrow(
        MixpanelArgumentError,
      );
      expect(() => hg.people.union("user_123", { tags: ["a"] })).toThrow(
        MixpanelArgumentError,
      );
      expect(() => hg.people.unset("user_123", "a")).toThrow(
        MixpanelArgumentError,
      );
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("explains how to name a user and company when rejecting a distinct id", () => {
      let error;
      try {
        hg.people.set("user_123", { plan: "pro" });
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(MixpanelArgumentError);
      expect(error.message).toContain("need a user and a company");
      expect(error.message).toContain(
        "MixpanelIdentity({ user_id, company_id })",
      );
      expect(error.message).toContain("$company:{company}|$user:{user}");
    });

    it("rejects a malformed combined distinct id", () => {
      const malformed = [
        "$company:acme|$user:", // missing user
        "$company:|$user:user_123", // missing company
        "$company:acme", // no user part
        "company:acme|$user:user_123", // wrong prefix
        "$user:user_123|$company:acme", // parts swapped
        " $company:acme|$user:user_123", // leading space
      ];
      for (const distinct_id of malformed) {
        expect(() => hg.people.set(distinct_id, { plan: "pro" })).toThrow(
          MixpanelArgumentError,
        );
        expect(() =>
          hg.people.set(identity({ distinct_id }), { plan: "pro" }),
        ).toThrow(MixpanelArgumentError);
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("splits a combined distinct id at the first user separator", () => {
      hg.people.set("$company:a:b|$user:c|$user:d", { plan: "pro" });

      expect(sent(hg).data).toMatchObject({
        $group_id: "c|$user:d",
        $company_id: "a:b",
      });
    });

    it("keeps $ip and $ignore_time on a combined distinct id update", () => {
      const callback = () => {};

      hg.people.set(
        combined_id,
        { plan: "pro", ip: "5.6.7.8", $ignore_time: true },
        callback,
      );
      hg.people.unset(combined_id, "plan", { $ip: "1.2.3.4" });

      const [[set_options, set_callback], [unset_options]] =
        hg.send_request.mock.calls;
      expect(set_options.endpoint).toBe("/groups");
      expect(set_options.data.$ip).toBe("5.6.7.8");
      expect(set_options.data.$ignore_time).toBe(true);
      expect(set_options.data.$set).toEqual({ plan: "pro" });
      expect(set_callback).toBe(callback);
      expect(unset_options.data.$ip).toBe("1.2.3.4");
    });

    it("uses the combined distinct id's company over for_company and a modifier", () => {
      hg.for_company("other").people.set(combined_id, { a: 1 });
      hg.people.set(combined_id, { a: 1 }, { $company_id: "other" });

      for (const [options] of hg.send_request.mock.calls) {
        expect(options.data.$company_id).toBe("acme");
      }
    });

    it("leaves events with a raw or combined distinct id unchanged", () => {
      hg.track("Signup", { distinct_id: "user_123" });
      hg.import("Signup", 1000, { distinct_id: combined_id });

      const [[track], [imported]] = hg.send_request.mock.calls;
      expect(track.endpoint).toBe("/track");
      expect(track.data.properties.distinct_id).toBe("user_123");
      expect(imported.endpoint).toBe("/import");
      expect(imported.data.properties.distinct_id).toBe(combined_id);
    });

    it("leaves legacy people methods unchanged", () => {
      legacy.people.set("user_123", { plan: "pro" });

      expect(sent(legacy)).toEqual({
        method: "GET",
        endpoint: "/engage",
        data: {
          $token: token,
          $distinct_id: "user_123",
          $set: { plan: "pro" },
        },
      });
    });

    it("sends an identity profile update to the user's group profile", () => {
      hg.people.set(hg_user(), { role: "admin" });

      expect(sent(hg)).toEqual({
        method: "GET",
        endpoint: "/groups",
        data: {
          $token: token,
          $group_key: "$user_id",
          $group_id: "user_123",
          $company_id: "acme",
          $set: { role: "admin" },
        },
      });
    });

    it("reroutes every identity profile operation", () => {
      const id = hg_user();
      hg.people.set(id, { plan: "pro" });
      hg.people.set_once(id, "plan", "pro");
      hg.people.delete_user(id);
      hg.people.remove(id, { tags: "a" });
      hg.people.union(id, { tags: ["a"] });
      hg.people.unset(id, "plan");

      const operations = [
        "$set",
        "$set_once",
        "$delete",
        "$remove",
        "$union",
        "$unset",
      ];
      const calls = hg.send_request.mock.calls;
      expect(calls).toHaveLength(operations.length);
      calls.forEach((call, i) => {
        expect(call[0].endpoint).toBe("/groups");
        expect(call[0].data).toHaveProperty(operations[i]);
        expect(call[0].data.$company_id).toBe("acme");
        expect(call[0].data.$group_id).toBe("user_123");
        expect(call[0].data).not.toHaveProperty("$distinct_id");
      });
    });

    it("keeps modifiers and the callback on a rerouted update", () => {
      const callback = () => {};

      hg.people.set(hg_user(), { role: "admin" }, { $ip: "1.2.3.4" }, callback);

      expect(sent(hg).data.$ip).toBe("1.2.3.4");
      expect(hg.send_request.mock.calls[0][1]).toBe(callback);
    });

    it("requires a hierarchical groups client for a hierarchical identity", () => {
      expect(() => legacy.people.set(hg_user(), { role: "admin" })).toThrow(
        /requires a hierarchical groups client/,
      );
    });

    it("uses the identity's company over for_company", () => {
      hg.for_company("other").people.set(hg_user(), { role: "admin" });

      expect(sent(hg).data.$company_id).toBe("acme");
    });

    it("sends a distinct id identity to /engage only without hierarchical groups", () => {
      legacy.people.set(identity({ distinct_id: "user_123" }), { a: 1 });
      hg.people.set(identity({ distinct_id: combined_id }), { a: 1 });

      expect(sent(legacy).endpoint).toBe("/engage");
      expect(sent(legacy).data.$distinct_id).toBe("user_123");
      expect(sent(hg)).toEqual({
        method: "GET",
        endpoint: "/groups",
        data: {
          $token: token,
          $group_key: "$user_id",
          $group_id: "user_123",
          $company_id: "acme",
          $set: { a: 1 },
        },
      });
    });

    it("rejects a raw distinct id identity on a hierarchical groups client", () => {
      expect(() =>
        hg.people.set(identity({ distinct_id: "user_123" }), { a: 1 }),
      ).toThrow(MixpanelArgumentError);
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("cannot identify a profile from a device id", () => {
      const device = identity({ device_id: "d" });

      expect(() => hg.people.set(device, { plan: "pro" })).toThrow(
        /names no user/,
      );
      expect(() => legacy.people.set(device, { plan: "pro" })).toThrow(
        /cannot identify a profile on this project/,
      );
    });

    it("rejects a company-only identity and points at the company profile", () => {
      expect(() =>
        hg.people.set(identity({ company_id: "acme" }), { tier: "ent" }),
      ).toThrow(/for_company\(company_id\)\.company\.set/);
    });

    it("takes the company from a $company_id modifier when the identity has none", () => {
      const id = identity({ user_id: "user_123", device_id: "d" });

      hg.people.set(id, { role: "admin" }, { $company_id: "acme" });
      expect(sent(hg).data.$company_id).toBe("acme");
      expect(sent(hg).data.$group_key).toBe("$user_id");

      expect(() => hg.people.set(id, { role: "admin" })).toThrow(
        MixpanelCompanyRequiredError,
      );
    });

    it("validates the identity even when the data is invalid", () => {
      expect(() => legacy.people.remove(hg_user(), "not an object")).toThrow(
        MixpanelArgumentError,
      );
      expect(() => legacy.people.union(hg_user(), [])).toThrow(
        MixpanelArgumentError,
      );
      expect(() => legacy.people.unset(hg_user(), 42)).toThrow(
        MixpanelArgumentError,
      );
    });
  });

  describe("group profiles", () => {
    it("adds a top-level $company_id when bound to a company", () => {
      hg.for_company("acme").groups.set("department", "finance", {
        plan: "enterprise",
      });

      const data = sent(hg).data;
      expect(data.$company_id).toBe("acme");
      expect(data.$group_key).toBe("department");
      expect(data.$group_id).toBe("finance");
      expect(data.$set).toEqual({ plan: "enterprise" });
    });

    it("sends user and company profiles with bare group ids", () => {
      const acme = hg.for_company("acme");
      acme.groups.set("$user_id", "user_123", { role: "admin" });
      acme.groups.set("$company_id", "acme", { tier: "ent" });

      const [user, company] = hg.send_request.mock.calls.map((c) => c[0].data);
      expect(user.$group_key).toBe("$user_id");
      expect(user.$group_id).toBe("user_123");
      expect(user.$company_id).toBe("acme");
      expect(company.$group_key).toBe("$company_id");
      expect(company.$group_id).toBe("acme");
      expect(company.$company_id).toBe("acme");
    });

    it("adds the company to every group operation", () => {
      const acme = hg.for_company("acme");
      acme.groups.set("department", "finance", { plan: "x" });
      acme.groups.set_once("department", "finance", { plan: "x" });
      acme.groups.delete_group("department", "finance");
      acme.groups.remove("department", "finance", { tags: "a" });
      acme.groups.union("department", "finance", { tags: ["a"] });
      acme.groups.unset("department", "finance", ["plan"]);

      const calls = hg.send_request.mock.calls;
      expect(calls).toHaveLength(6);
      for (const call of calls) {
        expect(call[0].endpoint).toBe("/groups");
        expect(call[0].data.$company_id).toBe("acme");
      }
    });

    it("requires a company on a hierarchical groups client", () => {
      expect(() =>
        hg.groups.set("department", "finance", { plan: "enterprise" }),
      ).toThrow(MixpanelCompanyRequiredError);
      expect(() => hg.groups.delete_group("department", "finance")).toThrow(
        /for_company/,
      );
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("accepts a $company_id modifier", () => {
      hg.groups.set(
        "department",
        "finance",
        { plan: "x" },
        {
          $company_id: "acme",
        },
      );

      expect(sent(hg).data.$company_id).toBe("acme");
    });

    it("drops a $company_id modifier on a legacy client, as before", () => {
      legacy.groups.set(
        "department",
        "finance",
        { plan: "x" },
        {
          $company_id: "acme",
        },
      );

      expect(sent(legacy).data).not.toHaveProperty("$company_id");
    });

    it("prefers the bound company over a modifier", () => {
      hg.for_company("acme").groups.set(
        "department",
        "finance",
        { plan: "x" },
        {
          $company_id: "other",
        },
      );

      expect(sent(hg).data.$company_id).toBe("acme");
    });

    it("leaves every pre-existing method unchanged on a legacy client", () => {
      legacy.people.set("u", { a: 1 });
      legacy.people.set_once("u", "a", 1);
      legacy.people.increment("u", "logins");
      legacy.people.append("u", "tags", "a");
      legacy.people.track_charge("u", 9.99);
      legacy.people.clear_charges("u");
      legacy.people.delete_user("u");
      legacy.people.remove("u", { tags: "a" });
      legacy.people.union("u", { tags: ["a"] });
      legacy.people.unset("u", "a");
      const people_calls = legacy.send_request.mock.calls.splice(0);
      expect(people_calls).toHaveLength(10);
      for (const [options] of people_calls) {
        expect(options.endpoint).toBe("/engage");
        expect(options.data.$distinct_id).toBe("u");
        expect(Object.keys(options.data).sort()).not.toContain("$company_id");
      }

      legacy.groups.set("company", "acme", { a: 1 });
      legacy.groups.set_once("company", "acme", "a", 1);
      legacy.groups.delete_group("company", "acme");
      legacy.groups.remove("company", "acme", { tags: "a" });
      legacy.groups.union("company", "acme", { tags: ["a"] });
      legacy.groups.unset("company", "acme", "a");
      const group_calls = legacy.send_request.mock.calls.splice(0);
      expect(group_calls).toHaveLength(6);
      for (const [options] of group_calls) {
        expect(options.endpoint).toBe("/groups");
        expect(options.data).not.toHaveProperty("$company_id");
      }
    });

    it("leaves legacy groups unchanged", () => {
      legacy.groups.set("company", "Acme Inc.", { plan: "x" });

      expect(sent(legacy)).toEqual({
        method: "GET",
        endpoint: "/groups",
        data: {
          $token: token,
          $group_key: "company",
          $group_id: "Acme Inc.",
          $set: { plan: "x" },
        },
      });
    });
  });

  describe("for_company", () => {
    it("rejects an empty company", () => {
      expect(() => hg.for_company("")).toThrow(MixpanelArgumentError);
      expect(() => hg.for_company(null)).toThrow(MixpanelArgumentError);
      expect(() => hg.for_company()).toThrow(MixpanelArgumentError);
    });

    it("keeps $add and $append refused", () => {
      expect(() =>
        hg.for_company("acme").people.increment("user_123", { logins: 1 }),
      ).toThrow(MixpanelUnsupportedOperationError);
    });

    it("leaves the receiver unchanged", () => {
      const acme = hg.for_company("acme");

      expect(acme).not.toBe(hg);
      expect(acme.company_id).toBe("acme");
      expect(hg.company_id).toBeUndefined();
      expect(() => hg.groups.set("department", "finance", { a: 1 })).toThrow(
        MixpanelCompanyRequiredError,
      );
    });

    it("rebinds from the original client", () => {
      const other = hg.for_company("acme").for_company("other");
      other.groups.set("department", "finance", { a: 1 });

      expect(other.company_id).toBe("other");
      expect(sent(hg).data.$company_id).toBe("other");
    });

    it("shares config, transport and flag providers", () => {
      const client = Mixpanel.init(token, {
        hierarchical_groups: true,
        remote_flags_config: {},
      });
      vi.spyOn(client, "send_request").mockImplementation(() => {});
      const acme = client.for_company("acme");

      expect(acme.config).toBe(client.config);
      expect(acme.remote_flags).toBe(client.remote_flags);
      expect(acme.hierarchical_groups).toBe(true);

      acme.set_config({ debug: true });
      expect(client.config.debug).toBe(true);
      client.config.logger = { ...console, debug: () => {} };

      acme.track(hg_user(), "Signup");
      expect(client.send_request).toHaveBeenCalledTimes(1);
      expect(
        client.send_request.mock.calls[0][0].data.properties,
      ).not.toHaveProperty("$group_key");
    });

    it("is harmless on a client without hierarchical groups", () => {
      legacy.for_company("acme").groups.set("company", "acme", { a: 1 });

      expect(sent(legacy).data.$company_id).toBe("acme");
    });
  });

  describe("company", () => {
    const cb = () => {};
    const mods = { $ignore_time: true, $ip: "1.2.3.4" };
    // [company call, equivalent groups call]
    const pairs = [
      [
        (c) => c.company.set({ tier: "ent" }),
        (c) => c.groups.set("$company_id", "acme", { tier: "ent" }),
      ],
      [
        (c) => c.company.set("tier", "ent", mods, cb),
        (c) => c.groups.set("$company_id", "acme", "tier", "ent", mods, cb),
      ],
      [
        (c) => c.company.set_once({ first: "x" }, mods),
        (c) => c.groups.set_once("$company_id", "acme", { first: "x" }, mods),
      ],
      [
        (c) => c.company.set_once("first", "x", cb),
        (c) => c.groups.set_once("$company_id", "acme", "first", "x", cb),
      ],
      [
        (c) => c.company.union({ tags: ["a"] }, mods, cb),
        (c) => c.groups.union("$company_id", "acme", { tags: ["a"] }, mods, cb),
      ],
      [
        (c) => c.company.remove({ tags: "a" }, cb),
        (c) => c.groups.remove("$company_id", "acme", { tags: "a" }, cb),
      ],
      [
        (c) => c.company.unset(["tier", "plan"], mods),
        (c) => c.groups.unset("$company_id", "acme", ["tier", "plan"], mods),
      ],
      [
        (c) => c.company.delete(mods, cb),
        (c) => c.groups.delete_group("$company_id", "acme", mods, cb),
      ],
      [
        (c) => c.company.delete(),
        (c) => c.groups.delete_group("$company_id", "acme"),
      ],
    ];

    it.each([
      ["hierarchical groups", () => hg],
      ["legacy", () => legacy],
    ])(
      "sends the same message as the groups call on a %s client",
      (_, client) => {
        const acme = client().for_company("acme");
        for (const [company_call, groups_call] of pairs) {
          company_call(acme);
          groups_call(acme);
        }

        const calls = client().send_request.mock.calls;
        expect(calls).toHaveLength(pairs.length * 2);
        for (let i = 0; i < calls.length; i += 2) {
          expect(calls[i]).toEqual(calls[i + 1]);
          expect(calls[i][0].data.$group_key).toBe("$company_id");
          expect(calls[i][0].data.$group_id).toBe("acme");
          expect(calls[i][0].data.$company_id).toBe("acme");
        }
      },
    );

    it.each([
      ["hierarchical groups", () => hg],
      ["legacy", () => legacy],
    ])("requires a bound company on a %s client", (_, client) => {
      const c = client();
      for (const call of [
        () => c.company.set({ tier: "ent" }),
        () => c.company.set_once({ tier: "ent" }),
        () => c.company.union({ tags: ["a"] }),
        () => c.company.remove({ tags: "a" }),
        () => c.company.unset("tier"),
        () => c.company.delete(),
      ]) {
        expect(call).toThrow(MixpanelCompanyRequiredError);
        expect(call).toThrow(/for_company\(company_id\)/);
      }
      expect(c.send_request).not.toHaveBeenCalled();
    });

    it("targets the company each client is bound to", () => {
      hg.for_company("acme").for_company("other").company.set({ a: 1 });

      const data = sent(hg).data;
      expect(data.$group_id).toBe("other");
      expect(data.$company_id).toBe("other");
    });
  });

  describe("feature flags", () => {
    it("flag providers inherit hierarchical_groups from the client", () => {
      const flags_config = {
        local_flags_config: {
          enable_polling: false,
          hierarchical_groups: false,
        },
        remote_flags_config: {},
      };
      const hg_client = Mixpanel.init(token, {
        hierarchical_groups: true,
        ...flags_config,
      });
      const legacy_client = Mixpanel.init(token, flags_config);

      for (const client of [hg_client, legacy_client]) {
        for (const provider of [client.local_flags, client.remote_flags]) {
          expect(provider.providerConfig.hierarchical_groups).toBe(
            client.hierarchical_groups,
          );
        }
      }
    });

    it("sends exposure events through the client's track", () => {
      const client = Mixpanel.init(token, {
        hierarchical_groups: true,
        remote_flags_config: {},
      });
      vi.spyOn(client, "send_request").mockImplementation(() => {});

      client.remote_flags.trackExposureEvent(
        "my-flag",
        { variant_key: "on", variant_value: true },
        { $user_id: "user_123", $company_id: "acme" },
      );

      const { data } = sent(client);
      expect(data.event).toBe("$experiment_started");
      expect(data.properties.$user_id).toBe("user_123");
      expect(data.properties.$company_id).toBe("acme");
      expect(data.properties).not.toHaveProperty("distinct_id");
    });
  });
});
