var Mixpanel = require('../lib/mixpanel-node');

exports.config = {
    setUp: function(cb) {
        this.mixpanel = Mixpanel.init('asjdf');
        cb();
    },

    "is set to correct defaults": function(test) {
        test.deepEqual(this.mixpanel.config,
                       { test: false, debug: false },
                       "default config is correct");
        test.done();
    },

    "is modified by set_config": function(test) {
        test.equal(this.mixpanel.config.test, false, "default config has correct value for test");

        this.mixpanel.set_config({ test: true });

        test.equal(this.mixpanel.config.test, true, "set_config modifies the config");

        test.done();
    }
};
