var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon'),
    http        = require('http'),
    events      = require('events');

exports.send_request = {

    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token');

        this.endpoint = "/track",
        this.data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 1346876621
                }
            };

        this.expected_http_get = {
            host: 'api.mixpanel.com',
            headers: {},
            path: '/track?data=eyJldmVudCI6InRlc3QiLCJwcm9wZXJ0aWVzIjp7ImtleTEiOiJ2YWwxIiwidG9rZW4iOiJ0b2tlbiIsInRpbWUiOjEzNDY4NzY2MjF9fQ%3D%3D&ip=0&verbose=0'
        };


        Sinon.stub(http, 'get');

        this.http_emitter = new events.EventEmitter;
        this.res = new events.EventEmitter;

        http.get.returns(this.http_emitter);
        http.get.callsArgWith(1, this.res);

        next();
    },

    tearDown: function(next) {
        http.get.restore();

        next();
    },

    "sends correct data": function(test) {
        this.mixpanel.send_request(this.endpoint, this.data);

        test.ok(http.get.calledWithMatch(this.expected_http_get), "send_request didn't call http.get with correct arguments");

        test.done();
    },

    "includes config parameters": function(test) {
        this.mixpanel.set_config({ request_options: { scheme: 'test' } });
        this.expected_http_get.scheme = 'test'

        this.mixpanel.send_request(this.endpoint, this.data);
        test.ok(http.get.calledWithMatch(this.expected_http_get), "send_request didn't call http.get with correct arguments");

        test.done();
    },


    "handles mixpanel errors": function(test) {
        test.expect(1);
        this.mixpanel.send_request("/track", { event: "test" }, function(e) {
            test.equal(e.message, 'Mixpanel Server Error: 0', "error did not get passed back to callback");
            test.done();
        });

        this.res.emit('data', '0');
        this.res.emit('end');
    },

    "handles http.get errors": function(test) {
        test.expect(1);
        this.mixpanel.send_request("/track", { event: "test" }, function(e) {
            test.equal(e, 'error', "error did not get passed back to callback");
            test.done();
        });

        this.http_emitter.emit('error', 'error');
    }
};
