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

    it("rejects values that are neither strings nor integers, and unknown keys", () => {
      for (const key of ["distinct_id", "user_id", "company_id", "device_id"]) {
        for (const value of [1.5, NaN, Infinity, true, {}, [], ["a"]]) {
          expect(() => identity({ [key]: value })).toThrow(
            MixpanelArgumentError,
          );
        }
      }
      expect(() => identity({ userId: "user_123" })).toThrow(/Unknown/);
      expect(() => new MixpanelIdentity()).toThrow(MixpanelArgumentError);
      expect(() => new MixpanelIdentity("user_123")).toThrow(
        MixpanelArgumentError,
      );
    });

    it("rejects whitespace-only user and company ids", () => {
      for (const key of ["user_id", "company_id"]) {
        for (const value of [" ", "  ", "\t\n"]) {
          expect(() => identity({ [key]: value })).toThrow(
            MixpanelArgumentError,
          );
          expect(() => identity({ [key]: value })).toThrow(/only whitespace/);
        }
      }
    });

    it("keeps non-blank ids with whitespace, and blank distinct and device ids, as given", () => {
      const id = identity({
        user_id: " u ",
        company_id: " c",
        distinct_id: " ",
        device_id: " ",
      });

      expect(id.user_id).toBe(" u ");
      expect(id.company_id).toBe(" c");
      expect(id.distinct_id).toBe(" ");
      expect(id.device_id).toBe(" ");
    });

    it("accepts integer ids and keeps them as numbers", () => {
      const id = identity({
        distinct_id: 1,
        user_id: 123,
        company_id: 0,
        device_id: -7,
      });

      expect(id.distinct_id).toBe(1);
      expect(id.user_id).toBe(123);
      expect(id.company_id).toBe(0);
      expect(id.device_id).toBe(-7);
      expect(id.is_hierarchical).toBe(true);
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

    it("builds a flag context", () => {
      const id = identity({
        user_id: "user_123",
        company_id: "acme",
        device_id: "device_abc",
      });

      expect(
        id.to_flag_context({
          groups: { department: "finance" },
          custom_properties: { plan: "enterprise" },
        }),
      ).toEqual({
        $user_id: "user_123",
        $company_id: "acme",
        device_id: "device_abc",
        department: "finance",
        custom_properties: { plan: "enterprise" },
      });
    });

    it("builds a flag context from a plain distinct id", () => {
      expect(identity({ distinct_id: "user_123" }).to_flag_context()).toEqual({
        distinct_id: "user_123",
      });
    });

    it("builds a flag context with every id as a string, leaving groups and custom properties as given", () => {
      const context = identity({
        distinct_id: 1,
        user_id: 2,
        company_id: 0,
        device_id: 4,
      }).to_flag_context({
        groups: { team_id: 5 },
        custom_properties: { seats: 6 },
      });

      expect(context).toEqual({
        distinct_id: "1",
        $user_id: "2",
        $company_id: "0",
        device_id: "4",
        team_id: 5,
        custom_properties: { seats: 6 },
      });
    });

    it("accepts | in ids, which only a hierarchical groups client refuses", () => {
      const id = identity({ user_id: "a|b", company_id: "c|d" });
      expect(id.user_id).toBe("a|b");
      expect(id.company_id).toBe("c|d");
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

    it("treats null and false as off without throwing", () => {
      for (const value of [null, false, undefined]) {
        const client = Mixpanel.init(token, { hierarchical_groups: value });
        expect(client.hierarchical_groups).toBe(false);
      }
    });

    it("still rejects non-boolean values like strings and numbers", () => {
      for (const value of ["true", "false", 1, 0]) {
        expect(() =>
          Mixpanel.init(token, { hierarchical_groups: value }),
        ).toThrow(MixpanelArgumentError);
      }
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

    it("sends integer user and company ids as strings", () => {
      // ingestion drops an integer $user_id, so the wire value is a string
      hg.track(identity({ user_id: 123, company_id: 42 }), "Signup");
      hg.import(identity({ user_id: 0, company_id: 0 }), "Signup", 1000);

      const [[track], [imported]] = hg.send_request.mock.calls;
      expect(track.data.properties.$user_id).toBe("123");
      expect(track.data.properties.$company_id).toBe("42");
      expect(imported.data.properties.$user_id).toBe("0");
      expect(imported.data.properties.$company_id).toBe("0");
    });

    it("sends every identity id as a string and other properties unchanged", () => {
      hg.track(
        identity({ user_id: "u", company_id: "c", device_id: 7 }),
        "Signup",
        { $user_id: 1, other: 2 },
      );

      const props = event_properties(hg);
      expect(props.$user_id).toBe("u");
      expect(props.$company_id).toBe("c");
      expect(props.$device_id).toBe("7");
      expect(props.other).toBe(2);
    });

    it("sends integer identity ids as strings on a legacy client", () => {
      legacy.track(identity({ user_id: 123, device_id: 7 }), "Signup");
      legacy.import(identity({ distinct_id: 0 }), "Signup", 1000);

      const [[track], [imported]] = legacy.send_request.mock.calls;
      expect(track.data.properties.$user_id).toBe("123");
      expect(track.data.properties.$device_id).toBe("7");
      expect(imported.data.properties.distinct_id).toBe("0");
    });

    it("sends an integer identity distinct id as a string to /engage on a legacy client", () => {
      legacy.people.set(identity({ distinct_id: 7 }), { plan: "pro" });
      legacy.people.set(7, { plan: "pro" });

      const [[from_identity], [raw]] = legacy.send_request.mock.calls;
      expect(from_identity.data.$distinct_id).toBe("7");
      expect(raw.data.$distinct_id).toBe(7);
    });

    it("never stringifies raw event properties", () => {
      for (const client of [hg, legacy]) {
        client.track("Signup", { distinct_id: 7, $device_id: 8, n: 9 });
        client.track(identity({ device_id: "d" }), "Signup", { n: 9 });
        const [[raw], [with_identity]] = client.send_request.mock.calls;
        expect(raw.data.properties).toMatchObject({
          distinct_id: 7,
          $device_id: 8,
          n: 9,
        });
        expect(with_identity.data.properties.n).toBe(9);
      }
    });

    it("refuses an event whose combined distinct id names another company or user", () => {
      for (const call of [
        () =>
          hg.track("Signup", { distinct_id: combined_id, $company_id: "zz" }),
        () =>
          hg.import("Signup", 1000, {
            distinct_id: combined_id,
            $company_id: "zz",
          }),
      ]) {
        expect(call).toThrow(MixpanelArgumentError);
        expect(call).toThrow(
          `distinct_id ${combined_id} names company acme, but $company_id is zz. Nothing sent`,
        );
      }
      for (const call of [
        () => hg.track("Signup", { distinct_id: combined_id, $user_id: "zz" }),
        () =>
          hg.import("Signup", 1000, {
            distinct_id: combined_id,
            $user_id: "zz",
          }),
      ]) {
        expect(call).toThrow(
          `distinct_id ${combined_id} names user user_123, but $user_id is zz. Nothing sent`,
        );
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("sends a combined distinct id with matching ids unchanged", () => {
      const properties = {
        distinct_id: "$company:42|$user:7",
        $company_id: 42,
        $user_id: "7",
      };
      hg.track("Signup", { ...properties });
      hg.import("Signup", 1000, { ...properties });

      for (const call of hg.send_request.mock.calls) {
        expect(call[0].data.properties).toMatchObject(properties);
      }
    });

    it("leaves a conflicting combined distinct id event unchanged on a legacy client", () => {
      legacy.track("Signup", { distinct_id: combined_id, $company_id: "zz" });

      expect(event_properties(legacy)).toEqual({
        distinct_id: combined_id,
        $company_id: "zz",
        token,
        mp_lib: "node",
        $lib_version: expect.any(String),
      });
    });

    it("leaves an explicit identity's combined distinct id unchanged", () => {
      hg.track(identity({ distinct_id: combined_id }), "Signup", {
        $company_id: "zz",
      });

      expect(event_properties(hg).$company_id).toBe("zz");
    });

    // combined-shaped distinct ids with an empty or whitespace-only part
    const blank_part_ids = [
      ["$company:|$user:u", "company"],
      ["$company:c|$user:", "user"],
      ["$company:|$user:", "company"],
      ["$company: |$user:u", "company"],
      ["$company:c|$user:  ", "user"],
    ];

    it("refuses a combined distinct id with a blank company or user", () => {
      for (const [distinct_id, part] of blank_part_ids) {
        const message = `distinct_id ${JSON.stringify(distinct_id)} names a blank ${part}. Nothing sent`;
        const event_list = [{ event: "Signup", properties: { distinct_id } }];
        for (const call of [
          () => hg.track("Signup", { distinct_id }),
          () => hg.import("Signup", 1000, { distinct_id }),
          () => hg.track_batch(event_list),
          () => hg.import_batch(event_list),
          () => hg.people.set(distinct_id, { a: 1 }),
          () => hg.people.set(identity({ distinct_id }), { a: 1 }),
          () => hg.people.delete_user(distinct_id),
        ]) {
          expect(call).toThrow(MixpanelArgumentError);
          expect(call).toThrow(message);
        }
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("refuses an identity whose combined distinct id has a blank part", () => {
      for (const [distinct_id, part] of blank_part_ids) {
        const message = `distinct_id ${JSON.stringify(distinct_id)} names a blank ${part}. Nothing sent`;
        for (const call of [
          () => hg.track(identity({ distinct_id }), "Signup"),
          () => hg.import(identity({ distinct_id }), "Signup", 1000),
          () =>
            hg.track(
              identity({ distinct_id, user_id: "u", company_id: "c" }),
              "Signup",
            ),
          () => hg.people.set(identity({ distinct_id }), { a: 1 }),
          () => hg.people.delete_user(identity({ distinct_id })),
        ]) {
          expect(call).toThrow(MixpanelArgumentError);
          expect(call).toThrow(message);
        }
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("sends an identity's valid combined distinct id unchanged", () => {
      hg.track(identity({ distinct_id: combined_id }), "Signup");
      hg.import(identity({ distinct_id: combined_id }), "Signup", 1000);

      expect(hg.send_request).toHaveBeenCalledTimes(2);
      for (const call of hg.send_request.mock.calls) {
        expect(call[0].data.properties.distinct_id).toBe(combined_id);
      }
    });

    it("sends an identity's blank-part combined distinct id on a legacy client", () => {
      for (const [distinct_id] of blank_part_ids) {
        legacy.track(identity({ distinct_id }), "Signup");
        legacy.import(identity({ distinct_id }), "Signup", 1000);
      }

      expect(
        legacy.send_request.mock.calls.map(
          (call) => call[0].data.properties.distinct_id,
        ),
      ).toEqual(
        blank_part_ids.flatMap(([distinct_id]) => [distinct_id, distinct_id]),
      );
    });

    it("sends a non-combined distinct id with a blank-looking part as given", () => {
      for (const distinct_id of ["  ", "$company:acme", "$company:|user:u"]) {
        hg.track("Signup", { distinct_id });
      }
      expect(
        hg.send_request.mock.calls.map((c) => c[0].data.properties.distinct_id),
      ).toEqual(["  ", "$company:acme", "$company:|user:u"]);
    });

    it("sends a combined distinct id with a blank part unchanged on a legacy client", () => {
      for (const [distinct_id] of blank_part_ids) {
        legacy.track("Signup", { distinct_id });
        legacy.people.set(distinct_id, { a: 1 });
      }
      const ids = legacy.send_request.mock.calls.map(
        (c) => c[0].data.properties?.distinct_id ?? c[0].data.$distinct_id,
      );
      expect(ids).toEqual(blank_part_ids.flatMap(([id]) => [id, id]));
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

    it("sends a user without a company as given on a hierarchical groups client", () => {
      hg.track(identity({ user_id: "user_123" }), "Signup");

      const properties = event_properties(hg);
      expect(properties.$user_id).toBe("user_123");
      expect(properties).not.toHaveProperty("$company_id");
      expect(properties).not.toHaveProperty("distinct_id");
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
    it("refuses a batch with a conflicting combined distinct id before sending any of it", () => {
      const event_list = [
        {
          event: "Ok",
          properties: { distinct_id: combined_id, $company_id: "acme" },
        },
        {
          event: "Bad",
          properties: { distinct_id: combined_id, $company_id: "zz" },
        },
      ];
      expect(() => hg.track_batch(event_list)).toThrow(
        `distinct_id ${combined_id} names company acme, but $company_id is zz. Nothing sent`,
      );
      expect(() => hg.import_batch(event_list)).toThrow(MixpanelArgumentError);
      expect(hg.send_request).not.toHaveBeenCalled();

      legacy.track_batch(event_list);
      expect(legacy.send_request).toHaveBeenCalled();
    });
  });

  describe("identity whose distinct id disagrees with its ids", () => {
    const old_user_id = "$company:acme|$user:old";
    const user_conflict = () =>
      identity({
        distinct_id: old_user_id,
        user_id: "new",
        company_id: "acme",
      });
    const user_message = `distinct_id ${old_user_id} names user old, but user_id is new. Nothing sent`;

    it("refuses a profile set, a delete and an event naming another user", () => {
      for (const call of [
        () => hg.people.set(user_conflict(), { plan: "pro" }),
        () => hg.people.set_once(user_conflict(), { plan: "pro" }),
        () => hg.people.unset(user_conflict(), "plan"),
        () => hg.people.union(user_conflict(), { tags: ["a"] }),
        () => hg.people.remove(user_conflict(), { tags: "a" }),
        () => hg.people.delete_user(user_conflict()),
        () => hg.track(user_conflict(), "Signup"),
        () => hg.import(user_conflict(), "Signup", 1000),
      ]) {
        expect(call).toThrow(MixpanelArgumentError);
        expect(call).toThrow(user_message);
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("refuses an identity whose distinct id names another company", () => {
      const company_conflict = () =>
        identity({ distinct_id: combined_id, company_id: "other" });
      const message = `distinct_id ${combined_id} names company acme, but company_id is other. Nothing sent`;
      for (const call of [
        () => hg.people.set(company_conflict(), { plan: "pro" }),
        () => hg.people.delete_user(company_conflict()),
        () => hg.track(company_conflict(), "Signup"),
      ]) {
        expect(call).toThrow(MixpanelArgumentError);
        expect(call).toThrow(message);
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("accepts an identity whose ids agree with its distinct id", () => {
      hg.people.set(
        identity({
          distinct_id: combined_id,
          user_id: "user_123",
          company_id: "acme",
        }),
        { plan: "pro" },
      );
      hg.people.delete_user(
        identity({
          distinct_id: "$company:42|$user:7",
          user_id: 7,
          company_id: 42,
        }),
      );
      hg.track(
        identity({ distinct_id: "$company:42|$user:7", user_id: 7 }),
        "Signup",
      );

      const [[set], [deleted], [tracked]] = hg.send_request.mock.calls;
      expect(set.data.$group_id).toBe("user_123");
      expect(set.data.$company_id).toBe("acme");
      expect(deleted.data.$group_id).toBe("7");
      expect(deleted.data.$company_id).toBe("42");
      expect(tracked.data.properties.$user_id).toBe("7");
    });

    it("leaves a legacy client unchanged", () => {
      const legacy_identity = identity({
        distinct_id: old_user_id,
        user_id: "new",
      });

      legacy.track(legacy_identity, "Signup");
      legacy.people.set(legacy_identity, { plan: "pro" });

      const [[tracked], [set]] = legacy.send_request.mock.calls;
      expect(tracked.data.properties.distinct_id).toBe(old_user_id);
      expect(tracked.data.properties.$user_id).toBe("new");
      expect(set.data.$distinct_id).toBe(old_user_id);
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

    it("splits a combined distinct id at the user separator", () => {
      hg.people.set("$company:a:b|$user:c:d", { plan: "pro" });

      expect(sent(hg).data).toMatchObject({
        $group_id: "c:d",
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

    it("refuses a $company_id modifier naming another company than the combined distinct id", () => {
      const call = () =>
        hg.people.set(combined_id, { a: 1 }, { $company_id: "other" });

      expect(call).toThrow(MixpanelArgumentError);
      expect(call).toThrow(
        `distinct_id ${combined_id} names company acme, but $company_id is other. Nothing sent`,
      );
      expect(() =>
        hg.people.unset(combined_id, "a", { $company_id: "other" }),
      ).toThrow(MixpanelArgumentError);
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("accepts a $company_id modifier matching the combined distinct id", () => {
      hg.people.set("$company:42|$user:7", { a: 1 }, { $company_id: 42 });
      hg.people.set(combined_id, { a: 1 }, { $company_id: "" });

      const [[matching], [empty]] = hg.send_request.mock.calls;
      expect(matching.data.$company_id).toBe("42");
      expect(matching.data.$group_id).toBe("7");
      expect(empty.data.$company_id).toBe("acme");
    });

    it("keeps an identity's combined distinct id company over a modifier", () => {
      hg.people.set(
        identity({ distinct_id: combined_id }),
        { a: 1 },
        { $company_id: "other" },
      );

      expect(sent(hg).data.$company_id).toBe("acme");
    });

    it("refuses a combined distinct id from another company on a bound client", () => {
      expect(() =>
        hg.for_company("other").people.set(combined_id, { a: 1 }),
      ).toThrow(/bound to company "other".*belongs to company "acme"/);
      expect(hg.send_request).not.toHaveBeenCalled();
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

    it("accepts a user from the bound company", () => {
      hg.for_company("acme").people.set(hg_user(), { role: "admin" });

      expect(sent(hg).data.$company_id).toBe("acme");
    });

    it("refuses a user from another company on a bound client", () => {
      expect(() =>
        hg.for_company("other").people.set(hg_user(), { role: "admin" }),
      ).toThrow(MixpanelArgumentError);
      expect(hg.send_request).not.toHaveBeenCalled();
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

    it("uses the bound company for a user-only identity on a bound client", () => {
      const acme = hg.for_company("acme");
      const id = identity({ user_id: "user_123" });

      acme.people.set(id, { plan: "pro" });
      acme.people.set_once(id, "plan", "pro");
      acme.people.union(id, { tags: ["a"] });
      acme.people.remove(id, { tags: "a" });
      acme.people.unset(id, "plan");
      acme.people.delete_user(id);

      const operations = [
        "$set",
        "$set_once",
        "$union",
        "$remove",
        "$unset",
        "$delete",
      ];
      const calls = hg.send_request.mock.calls;
      expect(calls).toHaveLength(operations.length);
      calls.forEach((call, i) => {
        expect(call[0].endpoint).toBe("/groups");
        expect(call[0].data).toHaveProperty(operations[i]);
        expect(call[0].data.$group_key).toBe("$user_id");
        expect(call[0].data.$group_id).toBe("user_123");
        expect(call[0].data.$company_id).toBe("acme");
        expect(call[0].data).not.toHaveProperty("$distinct_id");
      });
    });

    it("never lets a $company_id modifier override the bound company", () => {
      const acme = hg.for_company("acme");

      acme.people.set(
        identity({ user_id: "user_123", device_id: "d" }),
        { plan: "pro" },
        { $company_id: "other" },
      );
      expect(sent(hg).data.$company_id).toBe("acme");

      hg.send_request.mockClear();
      acme.people.set(hg_user(), { plan: "pro" }, { $company_id: "other" });
      expect(sent(hg).data.$company_id).toBe("acme");
    });

    it("still refuses a user-only identity's company that differs from the bound one", () => {
      expect(() =>
        hg
          .for_company("other")
          .people.set(identity({ user_id: "user_123", company_id: "acme" }), {
            plan: "pro",
          }),
      ).toThrow(MixpanelArgumentError);
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("compares integer and string company ids as strings", () => {
      hg.for_company(42).people.set(
        identity({ user_id: 7, company_id: "42" }),
        { plan: "pro" },
      );
      expect(sent(hg).data.$company_id).toBe("42");
      expect(sent(hg).data.$group_id).toBe("7");

      hg.send_request.mockClear();
      hg.for_company("42").people.set(
        identity({ user_id: 7, company_id: 42 }),
        { plan: "pro" },
      );
      expect(sent(hg).data.$company_id).toBe("42");

      hg.send_request.mockClear();
      hg.for_company(0).people.set(identity({ user_id: 7 }), { plan: "pro" });
      expect(sent(hg).data.$company_id).toBe("0");

      hg.send_request.mockClear();
      expect(() =>
        hg
          .for_company(42)
          .people.set(identity({ user_id: 7, company_id: 43 }), { a: 1 }),
      ).toThrow(MixpanelArgumentError);
      expect(() =>
        hg.for_company(42).people.set("$company:43|$user:7", { a: 1 }),
      ).toThrow(MixpanelArgumentError);
      hg.for_company(43).people.set("$company:43|$user:7", { a: 1 });
      expect(hg.send_request).toHaveBeenCalledTimes(1);
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

    it("accepts an integer $company_id modifier, including 0, and sends it as a string", () => {
      hg.groups.set("department", "finance", { plan: "x" }, { $company_id: 0 });

      expect(sent(hg).data.$company_id).toBe("0");
    });

    it("treats an empty $company_id modifier as missing", () => {
      expect(() =>
        hg.people.set(
          identity({ user_id: "u" }),
          { a: 1 },
          { $company_id: "" },
        ),
      ).toThrow(MixpanelCompanyRequiredError);
      expect(() =>
        hg.groups.set("department", "finance", { a: 1 }, { $company_id: "" }),
      ).toThrow(MixpanelCompanyRequiredError);
      expect(hg.send_request).not.toHaveBeenCalled();

      // a bound client still uses its company
      hg.for_company("acme").groups.set(
        "department",
        "finance",
        { a: 1 },
        { $company_id: "" },
      );
      expect(sent(hg).data.$company_id).toBe("acme");
    });

    it("rejects a $company_id modifier that is not a string or an integer", () => {
      for (const value of [{ x: 1 }, [], ["acme"], true, false, 1.5, NaN]) {
        for (const call of [
          () =>
            hg.groups.set(
              "department",
              "finance",
              { a: 1 },
              { $company_id: value },
            ),
          () =>
            hg.for_company("acme").groups.unset("department", "finance", "a", {
              $company_id: value,
            }),
          () =>
            hg.people.set(
              identity({ user_id: "u" }),
              { a: 1 },
              { $company_id: value },
            ),
          () => hg.people.set(combined_id, { a: 1 }, { $company_id: value }),
        ]) {
          expect(call).toThrow(MixpanelArgumentError);
        }
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only $company_id modifier", () => {
      for (const value of [" ", "  ", "\t\n"]) {
        expect(() =>
          hg.groups.set(
            "department",
            "finance",
            { a: 1 },
            { $company_id: value },
          ),
        ).toThrow(/only whitespace/);
        expect(() =>
          hg.people.set(
            identity({ user_id: "u" }),
            { a: 1 },
            { $company_id: value },
          ),
        ).toThrow(MixpanelArgumentError);
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("sends a valid $company_id modifier unchanged", () => {
      hg.groups.set("department", "finance", { a: 1 }, { $company_id: " a " });

      expect(sent(hg).data.$company_id).toBe(" a ");
    });

    it("still drops any $company_id modifier on a legacy client", () => {
      for (const value of ["", " ", { x: 1 }, true]) {
        legacy.groups.set(
          "department",
          "finance",
          { a: 1 },
          { $company_id: value },
        );
      }
      for (const [options] of legacy.send_request.mock.calls) {
        expect(options.data).toEqual({
          $token: token,
          $group_key: "department",
          $group_id: "finance",
          $set: { a: 1 },
        });
      }
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

    it("refuses a $company_id group that is not the bound company", () => {
      const acme = hg.for_company("acme");
      for (const call of [
        () => acme.groups.set("$company_id", "globex", { plan: "pro" }),
        () => acme.groups.set_once("$company_id", "globex", "plan", "pro"),
        () => acme.groups.delete_group("$company_id", "globex"),
        () => acme.groups.remove("$company_id", "globex", { tags: "a" }),
        () => acme.groups.union("$company_id", "globex", { tags: ["a"] }),
        () => acme.groups.unset("$company_id", "globex", "plan"),
      ]) {
        expect(call).toThrow(MixpanelArgumentError);
        expect(call).toThrow(
          "Group $company_id=globex does not match company acme. " +
            "A company profile is updated through for_company(globex).company. Nothing sent",
        );
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("refuses a $company_id group that is not the $company_id modifier", () => {
      expect(() =>
        hg.groups.set(
          "$company_id",
          "globex",
          { plan: "pro" },
          { $company_id: "acme" },
        ),
      ).toThrow(MixpanelArgumentError);
      expect(() =>
        hg.groups.delete_group("$company_id", "globex", { $company_id: 0 }),
      ).toThrow(/does not match company 0/);
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("sends a $company_id group that is the bound company unchanged", () => {
      hg.for_company("acme").groups.set("$company_id", "acme", {
        plan: "pro",
      });

      expect(sent(hg)).toEqual({
        method: "GET",
        endpoint: "/groups",
        data: {
          $token: token,
          $group_key: "$company_id",
          $group_id: "acme",
          $set: { plan: "pro" },
          $company_id: "acme",
        },
      });
    });

    it("compares a $company_id group with its company as strings", () => {
      hg.for_company(7).groups.set("$company_id", "7", { plan: "pro" });
      hg.groups.set("$company_id", 0, { plan: "pro" }, { $company_id: "0" });

      const [bound, modifier] = hg.send_request.mock.calls.map(
        (c) => c[0].data,
      );
      expect(bound.$group_id).toBe("7");
      expect(bound.$company_id).toBe("7");
      expect(modifier.$group_id).toBe(0);
      expect(modifier.$company_id).toBe("0");
    });

    it("sends a mismatched $company_id group on a legacy client, as before", () => {
      legacy.for_company("acme").groups.set("$company_id", "globex", {
        plan: "pro",
      });

      expect(sent(legacy).data).toEqual({
        $token: token,
        $group_key: "$company_id",
        $group_id: "globex",
        $set: { plan: "pro" },
        $company_id: "acme",
      });
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

    it("accepts an integer company and sends it as a string", () => {
      const acme = hg.for_company(42);
      expect(acme.company_id).toBe(42);

      acme.groups.set("department", "finance", { a: 1 });
      expect(sent(hg).data.$company_id).toBe("42");

      hg.send_request.mockClear();
      hg.for_company(0).company.set({ tier: "ent" });
      expect(sent(hg).data.$group_id).toBe("0");
      expect(sent(hg).data.$company_id).toBe("0");
    });

    it("sends an integer company as a string on a legacy client", () => {
      legacy.for_company(42).groups.set("department", "finance", { a: 1 });
      legacy.for_company(0).company.set({ tier: "ent" });

      const [[group], [company]] = legacy.send_request.mock.calls;
      expect(group.data.$company_id).toBe("42");
      expect(company.data.$group_id).toBe("0");
      expect(company.data.$company_id).toBe("0");
    });

    it("rejects a whitespace-only company", () => {
      for (const client of [hg, legacy]) {
        for (const value of [" ", "  ", "\t"]) {
          expect(() => client.for_company(value)).toThrow(
            MixpanelArgumentError,
          );
        }
      }
      expect(hg.for_company(" acme ").company_id).toBe(" acme ");
    });

    it("rejects companies that are neither strings nor integers", () => {
      for (const value of [1.5, NaN, true, {}, [], ["acme"]]) {
        expect(() => hg.for_company(value)).toThrow(MixpanelArgumentError);
      }
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

    it("logs and keeps the variant when the client refuses the exposure event", () => {
      const logger = {
        trace: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      };
      const client = Mixpanel.init(token, {
        hierarchical_groups: true,
        remote_flags_config: {},
        logger,
      });
      vi.spyOn(client, "send_request").mockImplementation(() => {});
      const provider = client.remote_flags;
      provider.logger = logger;

      expect(() =>
        provider.trackExposureEvent(
          "my-flag",
          { variant_key: "on", variant_value: true },
          { distinct_id: combined_id, $company_id: "zz" },
        ),
      ).not.toThrow();
      expect(client.send_request).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to track exposure event for flag 'my-flag'",
        ),
      );
    });

    it("logs and keeps the variant when the exposure's combined distinct id has a blank part", () => {
      const logger = {
        trace: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      };
      const client = Mixpanel.init(token, {
        hierarchical_groups: true,
        remote_flags_config: {},
        logger,
      });
      vi.spyOn(client, "send_request").mockImplementation(() => {});
      const provider = client.remote_flags;
      provider.logger = logger;

      for (const distinct_id of [
        "$company:|$user:u",
        "$company:c|$user:",
        "$company:|$user:",
        "$company: |$user:u",
        "$company:c|$user:  ",
      ]) {
        expect(() =>
          provider.trackExposureEvent(
            "my-flag",
            { variant_key: "on", variant_value: true },
            { distinct_id },
          ),
        ).not.toThrow();
        expect(logger.error).toHaveBeenLastCalledWith(
          expect.stringContaining(
            `Failed to track exposure event for flag 'my-flag': distinct_id ${JSON.stringify(distinct_id)} names a blank`,
          ),
        );
      }
      expect(client.send_request).not.toHaveBeenCalled();

      provider.trackExposureEvent(
        "my-flag",
        { variant_key: "on", variant_value: true },
        { distinct_id: combined_id },
      );
      expect(sent(client).data.properties.distinct_id).toBe(combined_id);
    });

    it("treats an empty or whitespace-only exposure $company_id or $user_id as missing", () => {
      const logger = {
        trace: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      };
      const client = Mixpanel.init(token, {
        hierarchical_groups: true,
        remote_flags_config: {},
        logger,
      });
      vi.spyOn(client, "send_request").mockImplementation(() => {});
      const provider = client.remote_flags;
      provider.logger = logger;
      const variant = { variant_key: "on", variant_value: true };

      for (const blank of ["", "   ", "\t\n"]) {
        provider.trackExposureEvent("my-flag", variant, {
          $company_id: blank,
          $user_id: "user_123",
        });
        expect(logger.error).toHaveBeenLastCalledWith(
          "Cannot track exposure event without a $company_id in the context",
        );
      }
      expect(client.send_request).not.toHaveBeenCalled();

      provider.trackExposureEvent("my-flag", variant, {
        $company_id: "acme",
        $user_id: "   ",
      });
      const { properties } = sent(client).data;
      expect(properties.$company_id).toBe("acme");
      expect(properties).not.toHaveProperty("$user_id");
      expect(properties).not.toHaveProperty("distinct_id");
    });

    it("does not stringify a raw flag context", () => {
      const client = Mixpanel.init(token, { remote_flags_config: {} });
      vi.spyOn(client, "send_request").mockImplementation(() => {});

      client.remote_flags.trackExposureEvent(
        "my-flag",
        { variant_key: "on", variant_value: true },
        { distinct_id: 7 },
      );

      expect(sent(client).data.properties.distinct_id).toBe(7);
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

  describe("| in user and company ids", () => {
    it("refuses an identity with | in its user or company id", () => {
      for (const ids of [
        { user_id: "a|b", company_id: "acme" },
        { user_id: "user_123", company_id: "a|b" },
        { company_id: "a|b" },
        { user_id: "a|b", device_id: "d" },
      ]) {
        expect(() => hg.track(identity(ids), "Signup")).toThrow(
          MixpanelArgumentError,
        );
        expect(() => hg.import(identity(ids), "Signup", 1000)).toThrow(/"\|"/);
      }
      expect(() =>
        hg.people.set(identity({ user_id: "a|b", company_id: "acme" }), {
          plan: "pro",
        }),
      ).toThrow(MixpanelArgumentError);
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("refuses for_company with | on a hierarchical groups client", () => {
      expect(() => hg.for_company("a|b")).toThrow(MixpanelArgumentError);
      expect(() => hg.for_company("a|b")).toThrow(/"\|"/);
    });

    it("refuses a $company_id modifier with |", () => {
      expect(() =>
        hg.groups.set("team_id", "t", { a: 1 }, { $company_id: "a|b" }),
      ).toThrow(MixpanelArgumentError);
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("refuses a combined distinct id with | in its company or user", () => {
      for (const distinct_id of [
        "$company:a|b|$user:user_123",
        "$company:acme|$user:c|$user:d",
        "$company:acme|$user:a|b",
      ]) {
        expect(() => hg.people.set(distinct_id, { plan: "pro" })).toThrow(
          MixpanelArgumentError,
        );
        expect(() => hg.track("Signup", { distinct_id })).toThrow(
          MixpanelArgumentError,
        );
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("sends custom group ids and other distinct ids with | as given", () => {
      hg.groups.set("team_id", "a|b", { a: 1 }, { $company_id: "acme" });
      hg.track("Signup", { distinct_id: "a|b" });

      const [[group], [event]] = hg.send_request.mock.calls;
      expect(group.data.$group_id).toBe("a|b");
      expect(event.data.properties.distinct_id).toBe("a|b");
    });

    it("leaves a legacy client unchanged", () => {
      legacy.track(identity({ user_id: "a|b", device_id: "d" }), "Signup");
      legacy.people.set(identity({ distinct_id: "a|b" }), { plan: "pro" });
      legacy.for_company("a|b").groups.set("team_id", "t", { a: 1 });

      const [[event], [profile], [group]] = legacy.send_request.mock.calls;
      expect(event.data.properties.$user_id).toBe("a|b");
      expect(profile.data.$distinct_id).toBe("a|b");
      expect(group.data.$company_id).toBe("a|b");
    });
  });

  describe("modifiers /groups rejects", () => {
    it("refuses $ignore_alias on every hierarchical groups profile update", () => {
      const modifiers = { $ignore_alias: true };
      const acme = hg.for_company("acme");
      for (const call of [
        () => hg.people.set(hg_user(), { a: 1 }, modifiers),
        () => hg.people.set(combined_id, "a", 1, modifiers),
        () => hg.people.delete_user(hg_user(), modifiers),
        () => hg.groups.set("team_id", "t", { a: 1 }, modifiers),
        () => acme.groups.unset("team_id", "t", "a", modifiers),
        () => acme.company.set({ a: 1 }, modifiers),
        () => acme.company.delete(modifiers),
      ]) {
        expect(call).toThrow(MixpanelArgumentError);
        expect(call).toThrow(/\$ignore_alias/);
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("refuses $distinct_id on group and company profile updates", () => {
      const modifiers = { $distinct_id: "user_123", $company_id: "acme" };
      const acme = hg.for_company("acme");
      for (const call of [
        () => hg.groups.set("team_id", "t", { a: 1 }, modifiers),
        () => acme.groups.union("team_id", "t", { a: "x" }, modifiers),
        () => acme.company.set({ a: 1 }, modifiers),
      ]) {
        expect(call).toThrow(MixpanelArgumentError);
        expect(call).toThrow(/\$distinct_id/);
      }
      expect(hg.send_request).not.toHaveBeenCalled();
    });

    it("never sends a $distinct_id modifier on a user profile update", () => {
      hg.people.set(hg_user(), { a: 1 }, { $distinct_id: "other" });

      const { data } = sent(hg);
      expect(data.$group_id).toBe("user_123");
      expect(data).not.toHaveProperty("$distinct_id");
    });

    it("leaves a legacy client unchanged", () => {
      legacy.people.set("bob", { a: 1 }, { $ignore_alias: true });
      legacy.groups.set(
        "team_id",
        "t",
        { a: 1 },
        { $ignore_alias: true, $distinct_id: "x" },
      );

      const [[profile], [group]] = legacy.send_request.mock.calls;
      expect(profile.data.$ignore_alias).toBe(true);
      expect(group.data.$ignore_alias).toBe(true);
      expect(group.data).not.toHaveProperty("$distinct_id");
    });
  });
});
