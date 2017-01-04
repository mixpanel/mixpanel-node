var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon'),
    mock_now_time = new Date(2016, 1, 1).getTime();

exports.track = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token');
        this.clock = Sinon.useFakeTimers(mock_now_time);

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

    "supports Date object for time": function(test) {
        var event = 'test',
            time = new Date(mock_now_time),
            props = { time: time },
            expected_endpoint = "/track",
            expected_data = {
                event: 'test',
                properties: {
                    token: 'token',
                    time: time.getTime() / 1000,
                    mp_lib: 'node'
                }
            };

        this.mixpanel.track(event, props);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "track didn't call send_request with correct arguments"
        );
        test.done();
    },

    "supports unix timestamp for time": function(test) {
        var event = 'test',
            time = mock_now_time / 1000,
            props = { time: time },
            expected_endpoint = "/track",
            expected_data = {
                event: 'test',
                properties: {
                    token: 'token',
                    time: time,
                    mp_lib: 'node'
                }
            };

        this.mixpanel.track(event, props);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "track didn't call send_request with correct arguments"
        );
        test.done();
    },

    "throws error if time property is older than 5 days": function(test) {
        var event = 'test',
            time = (mock_now_time - 1000 * 60 * 60 * 24 * 6) / 1000,
            props = { time: time };

        test.throws(
            this.mixpanel.track.bind(this, event, props),
            /`track` not allowed for event more than 5 days old/,
            "track didn't throw an error when time was more than 5 days ago"
        );
        test.done();
    },

    "throws error if time is not a number or Date": function(test) {
        var event = 'test',
            props = { time: 'not a number or Date' };

        test.throws(
            this.mixpanel.track.bind(this, event, props),
            /`time` property must be a Date or Unix timestamp/,
            "track didn't throw an error when time wasn't a number or Date"
        );
        test.done();
    },

    "does not require time property": function(test) {
        var event = 'test',
            props = {};

        test.doesNotThrow(this.mixpanel.track.bind(this, event, props));
        test.done();
    }
};
