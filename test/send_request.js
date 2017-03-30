var Mixpanel,
    Sinon          = require('sinon'),
    proxyquire     = require('proxyquire'),
    http           = require('http'),
    events         = require('events'),
    httpProxyOrig  = process.env.HTTP_PROXY,
    httpsProxyOrig = process.env.HTTPS_PROXY,
    HttpsProxyAgent;

exports.send_request = {
    setUp: function(next) {
        Sinon.stub(http, 'get');

        this.http_emitter = new events.EventEmitter;
        this.res = new events.EventEmitter;

        http.get.returns(this.http_emitter);
        http.get.callsArgWith(1, this.res);

        HttpsProxyAgent = Sinon.stub();

        Mixpanel = proxyquire('../lib/mixpanel-node', {
            'https-proxy-agent': HttpsProxyAgent
        });

        this.mixpanel = Mixpanel.init('token');

        next();
    },

    tearDown: function(next) {
        http.get.restore();

        // restore proxy variables
        process.env.HTTP_PROXY = httpProxyOrig;
        process.env.HTTPS_PROXY = httpsProxyOrig;

        next();
    },

    "sends correct data": function(test) {
        var endpoint = "/track",
            data = {
                event: 'test',
                properties: {
                    key1: 'val1',
                    token: 'token',
                    time: 1346876621
                }
            };

        var expected_http_get = {
            host: 'api.mixpanel.com',
            headers: {},
            path: '/track?data=eyJldmVudCI6InRlc3QiLCJwcm9wZXJ0aWVzIjp7ImtleTEiOiJ2YWwxIiwidG9rZW4iOiJ0b2tlbiIsInRpbWUiOjEzNDY4NzY2MjF9fQ%3D%3D&ip=0&verbose=0'
        };

        this.mixpanel.send_request(endpoint, data);

        test.ok(http.get.calledWithMatch(expected_http_get), "send_request didn't call http.get with correct arguments");

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
    },

    "uses correct hostname": function(test) {
        var host = 'testhost.fakedomain';
        var customHostnameMixpanel = Mixpanel.init('token', { host: host })
        var expected_http_get = {
            host: host
        };

        customHostnameMixpanel.send_request('', {});

        test.ok(http.get.calledWithMatch(expected_http_get), "send_request didn't call http.get with correct hostname");

        test.done();
    },

    "uses correct port": function(test) {
        var host = 'testhost.fakedomain:1337';
        var customHostnameMixpanel = Mixpanel.init('token', { host: host });
        var expected_http_get = {
            host: 'testhost.fakedomain',
            port: 1337
        };

        customHostnameMixpanel.send_request('', {});

        test.ok(http.get.calledWithMatch(expected_http_get), "send_request didn't call http.get with correct hostname and port");

        test.done();
    },

    "uses HTTP_PROXY if set": function(test) {
        HttpsProxyAgent.reset(); // Mixpanel is instantiated in setup, need to reset callcount
        process.env.HTTP_PROXY = 'this.aint.real.http';
        delete process.env.HTTPS_PROXY;

        var proxyMixpanel = Mixpanel.init('token');
        proxyMixpanel.send_request('', {});

        test.ok(HttpsProxyAgent.calledOnce, "HttpsProxyAgent was not called when process.env.HTTP_PROXY was set");

        var proxyPath = HttpsProxyAgent.firstCall.args[0];
        test.ok(proxyPath === 'this.aint.real.http', "HttpsProxyAgent was not called with the correct proxy path");

        var getConfig = http.get.firstCall.args[0];
        test.ok(getConfig.agent !== undefined, "send_request didn't call http.get with agent");

        test.done();
    },

    "uses HTTPS_PROXY if set": function(test) {
        HttpsProxyAgent.reset(); // Mixpanel is instantiated in setup, need to reset callcount
        delete process.env.HTTP_PROXY;
        process.env.HTTPS_PROXY = 'this.aint.real.https';

        var proxyMixpanel = Mixpanel.init('token');
        proxyMixpanel.send_request('', {});

        test.ok(HttpsProxyAgent.calledOnce, "HttpsProxyAgent was not called when process.env.HTTPS_PROXY was set");

        var proxyPath = HttpsProxyAgent.firstCall.args[0];
        test.ok(proxyPath === 'this.aint.real.https', "HttpsProxyAgent was not called with the correct proxy path");

        var getConfig = http.get.firstCall.args[0];
        test.ok(getConfig.agent !== undefined, "send_request didn't call http.get with agent");

        test.done();
    }
};
