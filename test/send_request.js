var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon'),
    http        = require('http'),
    events      = require('events');

exports.send_request = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token');

        Sinon.stub(http, 'request');
        this.http_emitter = new events.EventEmitter;
        this.http_end_spy = Sinon.spy();
        this.http_write_spy = Sinon.spy();
        this.http_emitter.write = this.http_write_spy;
        this.http_emitter.end = this.http_end_spy;
        this.res = new events.EventEmitter;
        http.request.returns(this.http_emitter);
        http.request.callsArgWith(1, this.res);

        next();
    },

    tearDown: function(next) {
        http.request.restore();

        next();
    },

    "sends correct data on GET": function(test) {
        var endpoint = "/track",
            data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 1346876621
                }
            },
            expected_http_request = {
                method: 'GET',
                host: 'api.mixpanel.com',
                headers: {},
                path: '/track?ip=0&verbose=0&data=eyJldmVudCI6InRlc3QiLCJwcm9wZXJ0aWVzIjp7ImtleTEiOiJ2YWwxIiwidG9rZW4iOiJ0b2tlbiIsInRpbWUiOjEzNDY4NzY2MjF9fQ%3D%3D'
            };

        this.mixpanel.send_request({ method: 'get', endpoint: endpoint, data: data });

        test.expect(3);
        test.ok(http.request.calledWithMatch(expected_http_request), "send_request didn't call http.request with correct arguments");
        test.ok(this.http_end_spy.callCount === 1, "send_request didn't end http.request");
        test.ok(this.http_write_spy.callCount === 0, "send_request called write for a GET");

        test.done();
    },

    "defaults to GET": function(test) {
        var endpoint = "/track",
            data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 1346876621
                }
            },
            expected_http_request = {
                method: 'GET',
                host: 'api.mixpanel.com',
                headers: {},
                path: '/track?ip=0&verbose=0&data=eyJldmVudCI6InRlc3QiLCJwcm9wZXJ0aWVzIjp7ImtleTEiOiJ2YWwxIiwidG9rZW4iOiJ0b2tlbiIsInRpbWUiOjEzNDY4NzY2MjF9fQ%3D%3D'
            };

        this.mixpanel.send_request({ endpoint: endpoint, data: data }); // method option not defined

        test.ok(http.request.calledWithMatch(expected_http_request), "send_request didn't call http.request with correct method argument");

        test.done();
    },

    "sends correct data on POST": function(test) {
        var endpoint = "/track",
            data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 1346876621
                }
            },
            expected_http_request = {
                method: 'POST',
                host: 'api.mixpanel.com',
                headers: {},
                path: '/track?ip=0&verbose=0'
            },
            expected_http_request_body = "data=eyJldmVudCI6InRlc3QiLCJwcm9wZXJ0aWVzIjp7ImtleTEiOiJ2YWwxIiwidG9rZW4iOiJ0b2tlbiIsInRpbWUiOjEzNDY4NzY2MjF9fQ==";

        this.mixpanel.send_request({ method: 'post', endpoint: endpoint, data: data });

        test.expect(3);
        test.ok(http.request.calledWithMatch(expected_http_request), "send_request didn't call http.request with correct arguments");
        test.ok(this.http_end_spy.callCount === 1, "send_request didn't end http.request");
        test.ok(this.http_write_spy.calledWithExactly(expected_http_request_body), "send_request did not write data correctly for a POST");

        test.done();
    },

    "handles mixpanel errors": function(test) {
        test.expect(1);
        this.mixpanel.send_request({ endpoint: "/track", data: { event: "test" } }, function(e) {
            test.equal(e.message, 'Mixpanel Server Error: 0', "error did not get passed back to callback");
            test.done();
        });

        this.res.emit('data', '0');
        this.res.emit('end');
    },

    "handles http.request errors": function(test) {
        test.expect(1);
        this.mixpanel.send_request({ endpoint: "/track", data: { event: "test" } }, function(e) {
            test.equal(e, 'error', "error did not get passed back to callback");
            test.done();
        });

        this.http_emitter.emit('error', 'error');
    },

    "uses correct hostname": function(test) {
        var host = 'testhost.fakedomain';
        var customHostnameMixpanel = Mixpanel.init('token', { host: host });
        var expected_http_request = {
            host: host
        };

        customHostnameMixpanel.send_request({ endpoint: "", data: {} });

        test.ok(http.request.calledWithMatch(expected_http_request), "send_request didn't call http.request with correct hostname");

        test.done();
    },

    "uses correct port": function(test) {
        var host = 'testhost.fakedomain:1337';
        var customHostnameMixpanel = Mixpanel.init('token', { host: host })
        var expected_http_request = {
            host: 'testhost.fakedomain',
            port: 1337
        };

        customHostnameMixpanel.send_request({ endpoint: "", data: {} });

        test.ok(http.request.calledWithMatch(expected_http_request), "send_request didn't call http.request with correct hostname and port");

        test.done();
    }
};
