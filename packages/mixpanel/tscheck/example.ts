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
hg.groups.set("$company_id", "acme", { tier: "enterprise" });
acme.groups.set("department", "finance", { budget: 1 });
hg.groups.set("department", "finance", { budget: 1 }, { $company_id: "acme" });
const hierarchical: boolean = user.is_hierarchical && acme.hierarchical_groups;
const company: string | undefined = acme.company_id;
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
