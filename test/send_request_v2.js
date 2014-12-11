var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon'),
    http        = require('http'),
    events      = require('events');

    var clock;
exports.send_request_v2 = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', {key: 'pretty', secret: 'really'});

        Sinon.stub(http, 'get');
        clock = Sinon.useFakeTimers();

        this.http_emitter = new events.EventEmitter();
        this.res = new events.EventEmitter();

        http.get.returns(this.http_emitter);
        http.get.callsArgWith(1, this.res);

        next();
    },

    tearDown: function(next) {
        http.get.restore();
        clock.restore();

        next();
    },

    "sends correct data": function(test) {
        var endpoint = "/export",
            data = {
                one: 'two',
                three: 'four'
            };

        var expected_http_get = {
            host: 'data.mixpanel.com',
            headers: {},
            path: '/api/2.0/export?one=two&three=four&api_key=pretty&expire=60&sig=25ce6fe76d7d1250165f58b0e30432ce'
        };

        this.mixpanel.send_request_v2(endpoint, data);

        test.ok(http.get.calledWithMatch(expected_http_get), "send_request_v2 didn't call http.get with correct arguments, got:" + JSON.stringify(http.get.getCall(0).args[0]));

        test.done();
    }
};

// vim: set et sw=4 ts=4:
