var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

exports.import = {
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
            time = 500,
            props = { key1: 'val1' },
            expected_endpoint = "/import",
            expected_data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 500
                }
            };

        this.mixpanel.import(event, time, props);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "import didn't call send_request with correct arguments"
        );

        test.done();
    },

    "supports a Date instance": function(test) {
        var event = "test",
            time = new Date,
            props = { key1: 'val1' },
            expected_endpoint = "/import",
            expected_data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 0
                }
            };

        this.mixpanel.import(event, time, props);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "import didn't call send_request with correct arguments"
        );

        test.done();
    },

    "requires the time argument": function(test) {
        test.throws(
            function() { this.mixpanel.import('test'); },
            "The import method requires you to specify the time of the event",
            "import didn't throw an error when time wasn't specified"
        );

        test.done();
    }
};

exports.import_batch = {
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
        var expected_endpoint = "/import",
            event_list = [
                {event: 'test',  properties: {key1: 'val1', time: 500 }},
                {event: 'test',  properties: {key2: 'val2', time: 1000}},
                {event: 'test2', properties: {key2: 'val2', time: 1500}}
            ],
            expected_data = [
                {event: 'test',  properties: {key1: 'val1', time: 500,  mp_lib: 'node', token: 'token'}},
                {event: 'test',  properties: {key2: 'val2', time: 1000, mp_lib: 'node', token: 'token'}},
                {event: 'test2', properties: {key2: 'val2', time: 1500, mp_lib: 'node', token: 'token'}}
            ];

        this.mixpanel.import_batch(event_list);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "import_batch didn't call send_request with correct arguments"
        );

        test.done();
    }
};
