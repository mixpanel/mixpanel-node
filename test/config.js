const Mixpanel = require('../lib/mixpanel-node');

describe('config', () => {
    let mixpanel;
    beforeEach(() => {
        mixpanel = Mixpanel.init('asjdf');
    })
    it("is set to correct defaults", () => {
        expect(mixpanel.config).toEqual({
            test: false,
            debug: false,
            verbose: false,
            host: 'api.mixpanel.com',
            protocol: 'https',
            path: '',
            keepAlive: true,
            geolocate: false,
            logger: console,
            strict: false,
        });
    });

    it("is modified by set_config", () => {
        expect(mixpanel.config.test).toBe(false);

        mixpanel.set_config({ test: true });

        expect(mixpanel.config.test).toBe(true);
    });

    it("can be set during init", () => {
        var mp = Mixpanel.init('token', { test: true });

        expect(mp.config.test).toBe(true);
    });

    it("supports strict config option", () => {
        var mp = Mixpanel.init('token', { strict: true });

        expect(mp.config.strict).toBe(true);
    });

    it("host config is split into host and port", () => {
        const exampleHost = 'api.example.com';
        const examplePort = 70;
        const hostWithoutPortConfig = Mixpanel.init('token', {host: exampleHost}).config;
        expect(hostWithoutPortConfig.port).toEqual(undefined);
        expect(hostWithoutPortConfig.host).toEqual(exampleHost);

        const hostWithPortConfig = Mixpanel.init('token', {host: `${exampleHost}:${examplePort}`}).config;
        expect(hostWithPortConfig.port).toBe(examplePort);
        expect(hostWithPortConfig.host).toBe(exampleHost);
    });
});
