var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

exports.track = {
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
        var event = "test",
            props = { key1: 'val1', time: '0' },
            expected_endpoint = "/import",
            expected_data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 0
                }
            };

        this.mixpanel.track(event, props);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "track didn't call send_request with correct arguments"
        );

        test.done();
    }
};
