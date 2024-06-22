const https = require('https');
const events = require('events');
const proxyquire = require('proxyquire');
const Mixpanel = require('../lib/mixpanel-node');
const packageInfo = require('../package.json');
const utils = require('../lib/utils');

var mock_now_time = new Date(2016, 1, 1).getTime();

describe('track', () => {
    let mixpanel;
    beforeAll(() => {
        mixpanel = Mixpanel.init('token');
        vi.useFakeTimers();
        vi.setSystemTime(mock_now_time);
        vi.spyOn(mixpanel, 'send_request');
    });

    afterAll(() => {
        vi.useRealTimers();
        mixpanel.send_request.mockRestore();
    });

    it('calls send_request with correct endpoint and data', () => {
        var event = 'test',
            props = { key1: 'val1' },
            expected_endpoint = '/track',
            expected_data = {
                event: 'test',
                properties: expect.objectContaining({
                    key1: 'val1',
                    token: 'token'
                }),
            };

        mixpanel.track(event, props);

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            expect.objectContaining({
                endpoint: expected_endpoint,
                data: expected_data
            }),
            undefined,
        );
    });

    it('can be called with optional properties', () => {
        var expected_endpoint = '/track',
            expected_data = {
                event: 'test',
                properties: expect.objectContaining({
                    token: 'token',
                }),
            };

        mixpanel.track('test');

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            expect.objectContaining({
                endpoint: expected_endpoint,
                data: expected_data,
            }),
            undefined,
        );
    });

    it('can be called with optional callback', (test) => {
        var expected_endpoint = '/track',
            expected_data = {
                event: 'test',
                properties: {
                    token: 'token',
                },
            };

        mixpanel.send_request.mockImplementationOnce((_, cb) => cb(undefined));

        const callback = vi.fn();
        mixpanel.track('test', callback);
        expect(callback).toHaveBeenCalledWith(undefined);
    });

    it('supports Date object for time', (test) => {
        var event = 'test',
            time = new Date(mock_now_time),
            props = { time: time },
            expected_endpoint = '/track',
            expected_data = {
                event: 'test',
                properties: expect.objectContaining({
                    token: 'token',
                    time: time.getTime(),
                    mp_lib: 'node',
                    $lib_version: packageInfo.version
                }),
            };

        mixpanel.track(event, props);

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            expect.objectContaining({
                endpoint: expected_endpoint,
                data: expected_data,
            }),
            undefined,
            );
    });

    it('supports unix timestamp for time', (test) => {
        var event = 'test',
            time = mock_now_time,
            props = { time: time },
            expected_endpoint = '/track',
            expected_data = {
                event: 'test',
                properties: expect.objectContaining({
                    token: 'token',
                    time: time,
                    mp_lib: 'node',
                    $lib_version: packageInfo.version
                }),
            };

        mixpanel.track(event, props);

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            expect.objectContaining({
                endpoint: expected_endpoint,
                data: expected_data,
            }),
            undefined,
        );
    });

    it('throws error if time is not a number or Date', () => {
        var event = 'test',
            props = { time: 'not a number or Date' };

        expect(() => mixpanel.track(event, props)).toThrowError(
            /`time` property must be a Date or Unix timestamp/,
        );
    });

    it('does not require time property', (test) => {
        var event = 'test',
        props = {};

        expect(() => mixpanel.track(event, props)).not.toThrowError();
    });
});

describe('track_batch', () => {
    let mixpanel;
    beforeEach(() => {
        mixpanel = Mixpanel.init('token');
        vi.useFakeTimers();
        vi.spyOn(mixpanel, 'send_request');
    });

    afterEach(() => {
        vi.useRealTimers();
        mixpanel.send_request.mockRestore();
    });

    it('calls send_request with correct endpoint, data, and method', () => {
        var expected_endpoint = '/track',
            event_list = [
                {event: 'test',  properties: { key1: 'val1', time: 500 }},
                {event: 'test',  properties: { key2: 'val2', time: 1000}},
                {event: 'test2', properties: { key2: 'val2', time: 1500}},
            ],
            expected_data = [
                {event: 'test', properties: { key1: 'val1', time: 500,   token: 'token'}},
                {event: 'test', properties: { key2: 'val2', time: 1000,  token: 'token'}},
                {event: 'test2', properties: { key2: 'val2', time: 1500, token: 'token'}}
            ].map((val) => expect.objectContaining(val));

        mixpanel.track_batch(event_list);

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            {
                method: 'POST',
                endpoint: expected_endpoint,
                data: expected_data,
            },
            expect.any(Function),
        );
    });

    it('does not require the time argument for every event', () => {
        var event_list = [
            {event: 'test',  properties: {key1: 'val1', time: 500 }},
            {event: 'test',  properties: {key2: 'val2', time: 1000}},
            {event: 'test2', properties: {key2: 'val2'            }}
        ];
        expect(() => mixpanel.track_batch(event_list)).not.toThrowError();
    });

    it('batches 50 events at a time', () => {
        var event_list = [];
        for (var ei = 0; ei < 130; ei++) { // 3 batches: 50 + 50 + 30
            event_list.push({
                event: 'test',
                properties: { key1: 'val1', time: 500 + ei },
            });
        }

        mixpanel.track_batch(event_list);

        expect(mixpanel.send_request).toHaveBeenCalledTimes(3);
    });
});

describe('track_batch_integration', () => {
    let mixpanel;
    let http_emitter;
    let res;
    let event_list;
    beforeEach(() => {
        mixpanel = Mixpanel.init('token', { key: 'key' });
        vi.useFakeTimers();

        vi.spyOn(https, 'request');

        http_emitter = new events.EventEmitter();

        // stub sequence of https responses
        res = [];
        for (let ri = 0; ri < 5; ri++) {
            res.push(new events.EventEmitter());
            https.request.mockImplementationOnce((_, cb) => {
                cb(res[ri]);
                return {
                    write: function () {},
                    end: function () {},
                    on: function (event) {},
                };
            });
        }

        event_list = [];
        for (var ei = 0; ei < 130; ei++) {// 3 batches: 50 + 50 + 30
            event_list.push({event: 'test', properties: { key1: 'val1', time: 500 + ei }});
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls provided callback after all requests finish', () => {
        const callback = vi.fn();
        mixpanel.track_batch(event_list, callback);
        for (var ri = 0; ri < 3; ri++) {
            res[ri].emit('data', '1');
            res[ri].emit('end');
        }
        expect(https.request).toHaveBeenCalledTimes(3);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(null, [
            undefined,
            undefined,
            undefined,
            ]);
    });

    it('passes error list to callback', () => {
        const callback = vi.fn();
        mixpanel.track_batch(event_list, callback);
        for (var ri = 0; ri < 3; ri++) {
            res[ri].emit('data', '0');
            res[ri].emit('end');
        }
        expect(callback.mock.calls[0][0].length).toBe(3);
    });

    it('calls provided callback when options are passed', () => {
        const callback = vi.fn();
        mixpanel.track_batch(event_list, { max_batch_size: 100 }, callback);
        for (var ri = 0; ri < 3; ri++) {
            res[ri].emit('data', '1');
            res[ri].emit('end');
        }
        expect(callback).toHaveBeenCalledTimes(1);
        expect(https.request).toHaveBeenCalledTimes(3);
        expect(callback).toHaveBeenCalledWith(null, [undefined]);
    });

    it('sends more requests when max_batch_size < 50', (test) => {
        const callback = vi.fn();
        mixpanel.track_batch(event_list, { max_batch_size: 30 }, callback);
        for (var ri = 0; ri < 5; ri++) {
            res[ri].emit('data', '1');
            res[ri].emit('end');
        }
        expect(callback).toHaveBeenCalledTimes(1);
        expect(https.request).toHaveBeenCalledTimes(5);
        expect(callback).toHaveBeenCalledWith(null, [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        ]);
    });

    it('can set max concurrent requests', (test) => {
        const async_all_stub = vi.fn();
        async_all_stub.mockImplementation((_, __, cb) => cb(null));
        const PatchedMixpanel = proxyquire('../lib/mixpanel-node', {
            './utils': { async_all: async_all_stub },
        });
        mixpanel = PatchedMixpanel.init('token', { key: 'key' });

        const callback = vi.fn();

        mixpanel.track_batch(event_list, { max_batch_size: 30, max_concurrent_requests: 2 }, callback);
        for (var ri = 0; ri < 3; ri++) {
            res[ri].emit('data', '1');
            res[ri].emit('end');
        }
        expect(callback).toHaveBeenCalledTimes(1);
        expect(async_all_stub).toHaveBeenCalledTimes(3);
        expect(callback).toHaveBeenCalledWith(null, undefined);
    });

    it('behaves well without a callback', () => {
        mixpanel.track_batch(event_list);
        expect(https.request).toHaveBeenCalledTimes(3);
        mixpanel.track_batch(event_list, { max_batch_size: 100 });
        expect(https.request).toHaveBeenCalledTimes(5);
    });
});
