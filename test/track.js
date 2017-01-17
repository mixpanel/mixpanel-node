var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon'),
    http        = require('http'),
    events      = require('events'),
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

exports.track_batch = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token');
        this.clock = Sinon.useFakeTimers();
        Sinon.stub(this.mixpanel, 'send_request');
        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_request.restore();
        this.clock.restore();
        next();
    },

    "calls send_request with correct endpoint and data2222": function(test) {
        var expected_endpoint = "/track",
            event_list = [
                {event: 'test',  properties: {key1: 'val1', time: 500 }},
                {event: 'test',  properties: {key2: 'val2', time: 1000}},
                {event: 'test2', properties: {key2: 'val2', time: 1500}}
            ],
            expected_data = [
                {event: 'test',  properties: {key1: 'val1', time: 500,  token: 'token'}},
                {event: 'test',  properties: {key2: 'val2', time: 1000, token: 'token'}},
                {event: 'test2', properties: {key2: 'val2', time: 1500, token: 'token'}}
            ];

        this.mixpanel.track_batch({event_list: event_list});

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "track_batch didn't call send_request with correct arguments"
        );

        test.done();
    },

    "does not require the time argument for every event": function(test) {
        var event_list = [
            {event: 'test',  properties: {key1: 'val1', time: 500 }},
            {event: 'test',  properties: {key2: 'val2', time: 1000}},
            {event: 'test2', properties: {key2: 'val2'            }}
        ];
        test.doesNotThrow(this.mixpanel.track_batch.bind(this, {event_list: event_list}));
        test.done();
    },

    "batches 50 events at a time": function(test) {
        var event_list = [];
        for (var ei = 0; ei < 130; ei++) { // 3 batches: 50 + 50 + 30
            event_list.push({event: 'test',  properties: {key1: 'val1', time: 500 + ei }});
        }

        this.mixpanel.track_batch({event_list: event_list});

        test.equals(
            3, this.mixpanel.send_request.callCount,
            "track_batch didn't call send_request correct number of times"
        );

        test.done();
    }
};

exports.track_batch_integration = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', { key: 'key' });
        this.clock = Sinon.useFakeTimers();

        Sinon.stub(http, 'get');

        this.http_emitter = new events.EventEmitter();

        // stub sequence of http responses
        this.res = [];
        for (var ri = 0; ri < 5; ri++) {
            this.res.push(new events.EventEmitter());
            http.get
                .onCall(ri)
                .callsArgWith(1, this.res[ri])
                .returns(this.http_emitter);
        }

        this.event_list = [];
        for (var ei = 0; ei < 130; ei++) { // 3 batches: 50 + 50 + 30
            this.event_list.push({event: 'test',  properties: {key1: 'val1', time: 500 + ei }});
        }

        next();
    },

    tearDown: function(next) {
        http.get.restore();
        this.clock.restore();

        next();
    },

    "calls provided callback after all requests finish": function(test) {
        test.expect(2);
        this.mixpanel.track_batch({event_list: this.event_list}, function(error_list) {
            test.equals(
                3, http.get.callCount,
                "track_batch didn't call send_request correct number of times before callback"
            );
            test.equals(
                null, error_list,
                "track_batch returned errors in callback unexpectedly"
            );
            test.done();
        });
        for (var ri = 0; ri < 3; ri++) {
            this.res[ri].emit('data', '1');
            this.res[ri].emit('end');
        }
    },

    "passes error list to callback": function(test) {
        test.expect(1);
        this.mixpanel.track_batch({event_list: this.event_list}, function(error_list) {
            test.equals(
                3, error_list.length,
                "track_batch didn't return errors in callback"
            );
            test.done();
        });
        for (var ri = 0; ri < 3; ri++) {
            this.res[ri].emit('data', '0');
            this.res[ri].emit('end');
        }
    },

    "calls provided callback when options are passed": function(test) {
        test.expect(2);
        this.mixpanel.track_batch({event_list: this.event_list, max_batch_size: 100}, function(error_list) {
            test.equals(
                3, http.get.callCount,
                "track_batch didn't call send_request correct number of times before callback"
            );
            test.equals(
                null, error_list,
                "track_batch returned errors in callback unexpectedly"
            );
            test.done();
        });
        for (var ri = 0; ri < 3; ri++) {
            this.res[ri].emit('data', '1');
            this.res[ri].emit('end');
        }
    },

    "sends more requests when max_batch_size < 50": function(test) {
        test.expect(2);
        this.mixpanel.track_batch({event_list: this.event_list, max_batch_size: 30}, function(error_list) {
            test.equals(
                5, http.get.callCount, // 30 + 30 + 30 + 30 + 10
                "track_batch didn't call send_request correct number of times before callback"
            );
            test.equals(
                null, error_list,
                "track_batch returned errors in callback unexpectedly"
            );
            test.done();
        });
        for (var ri = 0; ri < 5; ri++) {
            this.res[ri].emit('data', '1');
            this.res[ri].emit('end');
        }
    },

    "behaves well without a callback": function(test) {
        test.expect(2);
        this.mixpanel.track_batch({event_list: this.event_list});
        test.equals(
            3, http.get.callCount,
            "track_batch didn't call send_request correct number of times"
        );
        this.mixpanel.track_batch({event_list: this.event_list, max_batch_size: 100});
        test.equals(
            5, http.get.callCount, // 3 + 100 / 50; last request starts async
            "track_batch didn't call send_request correct number of times"
        );
        test.done();
    }
};

