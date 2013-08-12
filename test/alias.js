var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

exports.alias = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', { key: 'key' });
        this.clock = Sinon.useFakeTimers();

        Sinon.stub(this.mixpanel, 'send_request');

        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_request.restore();
        this.clock.restore();

        next();
    },

    "calls send_request with correct endpoint and data": function(test) {
        var alias = "test",
            distinct_id = "old_id",
            expected_endpoint = "/track",
            expected_data = {
                event: '$create_alias',
                properties: {
                    distinct_id: distinct_id,
                    alias: alias,
                    token: 'token'
                }
            };

        this.mixpanel.alias(alias, distinct_id);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "import didn't call send_request with correct arguments"
        );

        test.done();
    }
};
