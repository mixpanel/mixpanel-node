let Mixpanel;
const proxyquire = require('proxyquire');
const https = require('https');
const events = require('events');
const httpProxyOrig  = process.env.HTTP_PROXY;
const httpsProxyOrig = process.env.HTTPS_PROXY;
let HttpsProxyAgent;

describe("send_request", () => {
    let mixpanel;
    let http_emitter;
    let res;
    beforeEach(() => {
        HttpsProxyAgent = vi.fn();
        Mixpanel = proxyquire('../lib/mixpanel-node', {
            'https-proxy-agent': HttpsProxyAgent,
        });

        http_emitter = new events.EventEmitter();
        res = new events.EventEmitter();
        vi.spyOn(https, 'request')
            .mockImplementation((_, cb) => {
                cb(res);
                return http_emitter;
            })
        http_emitter.write = vi.fn();
        http_emitter.end = vi.fn();

        mixpanel = Mixpanel.init('token');

        return () => {
            https.request.mockRestore();

            // restore proxy variables
            process.env.HTTP_PROXY = httpProxyOrig;
            process.env.HTTPS_PROXY = httpsProxyOrig;
        }
    });

    it("sends correct data on GET", () => {
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

        mixpanel.send_request({ method: 'get', endpoint: endpoint, data: data });
        expect(https.request).toHaveBeenCalledWith(
            expect.objectContaining(expected_http_request),
            expect.any(Function)
        );
        expect(http_emitter.end).toHaveBeenCalledTimes(1);
        expect(http_emitter.write).toHaveBeenCalledTimes(0);
    });

    it("defaults to GET", () => {
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

        mixpanel.send_request({ endpoint: endpoint, data: data }); // method option not defined

        expect(https.request).toHaveBeenCalledWith(
            expect.objectContaining(expected_http_request),
            expect.any(Function),
        );
    });

    it("sends correct data on POST", () => {
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
                headers: expect.any(Object),
                path: '/track?ip=0&verbose=0'
            },
            expected_http_request_body = "data=eyJldmVudCI6InRlc3QiLCJwcm9wZXJ0aWVzIjp7ImtleTEiOiJ2YWwxIiwidG9rZW4iOiJ0b2tlbiIsInRpbWUiOjEzNDY4NzY2MjF9fQ==";

        mixpanel.send_request({ method: 'post', endpoint: endpoint, data: data });

        expect(https.request).toHaveBeenCalledWith(
            expect.objectContaining(expected_http_request),
            expect.any(Function),
        );
        expect(http_emitter.end).toHaveBeenCalledTimes(1);
        expect(http_emitter.write).toHaveBeenCalledWith(expected_http_request_body);
    });

    it("sets ip=1 when geolocate option is on", () => {
      mixpanel.set_config({ geolocate: true });

      mixpanel.send_request({ method: "get", endpoint: "/track", event: "test", data: {} });

      expect(https.request).toHaveBeenCalledWith(
          expect.objectContaining({
              path: expect.stringContaining('ip=1'),
          }),
          expect.any(Function),
      );
    });

    it("handles mixpanel errors", () => {
        mixpanel.send_request({ endpoint: "/track", data: { event: "test" } }, function(e) {
            expect(e.message).toBe('Mixpanel Server Error: 0')
        });

        res.emit('data', '0');
        res.emit('end');
    });

    it("handles https.request errors", () => {
        mixpanel.send_request({ endpoint: "/track", data: { event: "test" } }, function(e) {
            expect(e).toBe('error');
        });
        http_emitter.emit('error', 'error');
    });

    it("default use keepAlive agent", () => {
        var agent = new https.Agent({ keepAlive: false });
        var httpsStub = {
            request: vi.fn().mockImplementation((_, cb) => {
                cb(res)
                return http_emitter;
             }),
            Agent: vi.fn().mockReturnValue(agent),
        };
        // force SDK not use `undefined` string to initialize proxy-agent
        delete process.env.HTTP_PROXY
        delete process.env.HTTPS_PROXY
        Mixpanel = proxyquire('../lib/mixpanel-node', {
            'https': httpsStub
        });
        var proxyMixpanel = Mixpanel.init('token');
        proxyMixpanel.send_request({ endpoint: '', data: {} });

        var getConfig = httpsStub.request.mock.calls[0][0];
        var agentOpts = httpsStub.Agent.mock.calls[0][0];
        expect(agentOpts.keepAlive).toBe(true);
        expect(getConfig.agent).toBe(agent);
    });

    it("uses correct hostname", () => {
        var host = 'testhost.fakedomain';
        var customHostnameMixpanel = Mixpanel.init('token', { host: host });
        var expected_http_request = {
            host: host
        };

        customHostnameMixpanel.send_request({ endpoint: "", data: {} });

        expect(https.request).toHaveBeenCalledWith(
            expect.objectContaining(expected_http_request),
            expect.any(Function),
        );
    });

    it("uses correct port", () => {
        var host = 'testhost.fakedomain:1337';
        var customHostnameMixpanel = Mixpanel.init('token', { host: host });
        var expected_http_request = {
            host: 'testhost.fakedomain',
            port: 1337
        };

        customHostnameMixpanel.send_request({ endpoint: "", data: {} });

        expect(https.request).toHaveBeenCalledWith(
            expect.objectContaining(expected_http_request),
            expect.any(Function),
        );
    });

    it("uses correct path", () => {
        var host = 'testhost.fakedomain';
        var customPath = '/mypath';
        var customHostnameMixpanel = Mixpanel.init('token', {
            host,
            path: customPath,
        });
        var expected_http_request = {
            host,
            path: '/mypath?ip=0&verbose=0&data=e30%3D',
        };

        customHostnameMixpanel.send_request({endpoint: "", data: {}});
        expect(https.request).toHaveBeenCalledWith(
            expect.objectContaining(expected_http_request),
            expect.any(Function),
        );
    });

    it("combines custom path and endpoint", () => {
        var host = 'testhost.fakedomain';
        var customPath = '/mypath';
        var customHostnameMixpanel = Mixpanel.init('token', {
            host,
            path: customPath,
        });
        var expected_http_request = {
            host,
            path: '/mypath/track?ip=0&verbose=0&data=e30%3D',
        };

        customHostnameMixpanel.send_request({endpoint: '/track', data: {}});
        expect(https.request).toHaveBeenCalledWith(
            expect.objectContaining(expected_http_request),
            expect.any(Function),
        );
    });

    it("uses HTTP_PROXY if set", () => {
        HttpsProxyAgent.mockReset(); // Mixpanel is instantiated in setup, need to reset callcount
        delete process.env.HTTPS_PROXY;
        process.env.HTTP_PROXY = 'this.aint.real.https';

        var proxyMixpanel = Mixpanel.init('token');
        proxyMixpanel.send_request({ endpoint: '', data: {} });

        expect(HttpsProxyAgent).toHaveBeenCalledTimes(1);

        var agentOpts = HttpsProxyAgent.mock.calls[0][0];
        expect(agentOpts.pathname).toBe('this.aint.real.https');
        expect(agentOpts.keepAlive).toBe(true);

        var getConfig = https.request.mock.calls[0][0];
        expect(getConfig.agent).toBeTruthy();
    });

    it("uses HTTPS_PROXY if set", () => {
        HttpsProxyAgent.mockReset(); // Mixpanel is instantiated in setup, need to reset callcount
        delete process.env.HTTP_PROXY;
        process.env.HTTPS_PROXY = 'this.aint.real.https';

        var proxyMixpanel = Mixpanel.init('token');
        proxyMixpanel.send_request({ endpoint: '', data: {} });

        expect(HttpsProxyAgent).toHaveBeenCalledTimes(1);

        var proxyOpts = HttpsProxyAgent.mock.calls[0][0];
        expect(proxyOpts.pathname).toBe('this.aint.real.https');

        var getConfig = https.request.mock.calls[0][0];
        expect(getConfig.agent).toBeTruthy();
    });

    it("requires credentials for import requests", () => {
        expect(() => {
            mixpanel.send_request({
                endpoint: `/import`,
                data: {event: `test event`},
            })
        }).toThrowError(
            /The Mixpanel Client needs a Mixpanel API Secret when importing old events/,
        )
    });

    it("sets basic auth header if API secret is provided", () => {
        mixpanel.set_config({secret: `foobar`});
        mixpanel.send_request({
            endpoint: `/import`,
            data: {event: `test event`},
        });
        expect(https.request).toHaveBeenCalledTimes(1);
        expect(https.request.mock.calls[0][0].headers).toEqual({
            'Authorization': `Basic Zm9vYmFyOg==`, // base64 of "foobar:"
        })
    });

    it("still supports import with api_key (legacy)", () => {
        mixpanel.set_config({key: `barbaz`});
        mixpanel.send_request({
            endpoint: `/import`,
            data: {},
        });
        expect(https.request).toHaveBeenCalledTimes(1);
        expect(https.request.mock.calls[0][0].path).toBe(
            `/import?ip=0&verbose=0&data=e30%3D&api_key=barbaz`,
        );
    });
});
