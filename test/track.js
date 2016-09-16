var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon'),
    mockNowTime = new Date(2016, 1, 1).getTime();;

exports.track = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token');
        this.clock = Sinon.useFakeTimers(mockNowTime);

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
            props = { key1: 'val1' },
            expected_endpoint = "/track",
            expected_data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token'
                }
            };

        this.mixpanel.track(event, props);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "track didn't call send_request with correct arguments"
        );

        test.done();
    },

    "can be called with optional properties": function(test) {
        var expected_endpoint = "/track",
            expected_data = {
                event: 'test',
                properties: {
                    token: 'token'
                }
            };

        this.mixpanel.track("test");

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "track didn't call send_request with correct arguments"
        );
        test.done();
    },

    "can be called with optional callback": function(test) {
        var expected_endpoint = "/track",
            expected_data = {
                event: 'test',
                properties: {
                    token: 'token'
                }
            };

        this.mixpanel.send_request.callsArgWith(2, undefined);

        test.expect(1);
        this.mixpanel.track("test", function(e) {
            test.equal(e, undefined, "error should be undefined");
            test.done();
        });
    },

    "calls `track` endpoint if within last 5 days": function(test) {
        var expected_endpoint = "/track",
            expected_data = {
                event: 'test',
                properties: {
                    token: 'token',
                    time: mockNowTime / 1000
                }
            };

        this.mixpanel.send_request.callsArgWith(2, undefined);

        test.expect(1);
        this.mixpanel.track("test", function(e) {
            test.equal(e, undefined, "error should be undefined");
            test.done();
        });
    },

    "calls `import` endpoint if time older than 5 days": function(test) {
        var expected_endpoint = "/import",
            expected_data = {
                event: 'test',
                properties: {
                    token: 'token',
                    time: (mockNowTime - 1000 * 60 * 60 * 24 * 6) / 1000
                }
            };

        this.mixpanel.send_request.callsArgWith(2, undefined);

        test.expect(1);
        this.mixpanel.track("test", function(e) {
            test.equal(e, undefined, "error should be undefined");
            test.done();
        });
    }
};
