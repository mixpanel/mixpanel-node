// example module where typechecking should be working both in code editors and via `tsc`

import Mixpanel from "../lib/mixpanel-node.js";

const mp = Mixpanel.init("asjdf", { local_flags_config: {} });
mp.track("test event");
mp.local_flags?.getVariantValue("color", "blue", { distinct_id: "user_1" });
