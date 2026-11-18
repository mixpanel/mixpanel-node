// example module where typechecking should be working both in code editors and via `tsc`

import Mixpanel from "../lib/mixpanel-node.js";

const mp = Mixpanel.init("asjdf", { local_flags_config: {} });
mp.track("test event");
mp.local_flags?.getVariantValue("color", "blue", { distinct_id: "user_1" });

// hierarchical groups
const hg = Mixpanel.init("asjdf", { hierarchical_groups: true });
const user = new Mixpanel.MixpanelIdentity({
  user_id: "user_123",
  company_id: "acme",
});
hg.track(user, "Signup");
hg.track(user, "Signup", { plan: "pro" }, (err) => err);
hg.import(user, "Signup", new Date(), { plan: "pro" });
hg.import(user, "Signup", Date.now(), (err) => err);
hg.people.set(user, { role: "admin" });
hg.people.set_once(user, "first_seen", "today");
hg.people.unset(user, ["role"]);
hg.people.union(user, { tags: ["a"] });
hg.people.remove(user, { tags: "a" });
hg.people.delete_user(user);
const acme = hg.for_company("acme");
acme.groups.set("$company_id", "acme", { tier: "enterprise" });
acme.company.set({ tier: "enterprise" });
acme.company.set("tier", "enterprise", { $ignore_time: true }, (err) => err);
acme.company.set_once({ first_seen: "today" });
acme.company.union({ tags: ["a"] });
acme.company.remove({ tags: "a" });
acme.company.unset(["tier"]);
acme.company.delete((err) => err);
hg.groups.set("department", "finance", { budget: 1 }, { $company_id: "acme" });
hg.groups.set("department", "finance", { budget: 1 }, { $company_id: 42 });
const hierarchical: boolean = user.is_hierarchical && acme.hierarchical_groups;
const company: string | number | undefined = acme.company_id;
try {
  hg.people.increment("user_123", "logins");
} catch (err) {
  if (err instanceof Mixpanel.MixpanelUnsupportedOperationError) {
    console.log(err.code, hierarchical, company);
  } else if (
    err instanceof Mixpanel.MixpanelArgumentError ||
    err instanceof Mixpanel.MixpanelCompanyRequiredError
  ) {
    console.log(err.code);
  }
}

// feature flag contexts: a distinct id, or on a hierarchical groups project a
// user and company instead
const hg_flags = Mixpanel.init("asjdf", {
  hierarchical_groups: true,
  local_flags_config: {},
  remote_flags_config: {},
});
hg_flags.local_flags?.getVariantValue("color", "blue", {
  distinct_id: "user_1",
  plan: "pro",
});
hg_flags.local_flags?.getVariantValue("color", "blue", {
  $user_id: "user_123",
  $company_id: "acme",
});
void hg_flags.remote_flags?.isEnabled("color", {
  $user_id: 7,
  $company_id: 42,
  distinct_id: "$company:42|$user:7",
});
hg_flags.local_flags?.getAllVariants(user.to_flag_context());
// @ts-expect-error a context needs a distinct_id, or a $user_id and $company_id
hg_flags.local_flags?.getVariantValue("color", "blue", { plan: "pro" });
// @ts-expect-error a $company_id alone does not identify a flag context
hg_flags.local_flags?.isEnabled("color", { $company_id: "acme" });
