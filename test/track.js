var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

exports.track = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token');

        Sinon.stub(this.mixpanel, 'send_request');

        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_request.restore();

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

    "calls send_request with /track endpoint and data (time=now)": function(test) {
        var time = Date.now() / 1000;
        var event = "test",
            props = { key1: 'val1', time: time },
            expected_endpoint = "/track",
            expected_data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: time
                }
            };

        this.mixpanel.track(event, props);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "track didn't call send_request with correct arguments"
        );

        test.done();
    },

    "calls send_request with /import endpoint and data (time=past)": function(test) {
        var time = Date.now() / 1000 - 5 * 24 * 60 * 60;
        var event = "test",
            props = { key1: 'val1', time: time },
            expected_endpoint = "/import",
            expected_data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: time
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
    }
};
