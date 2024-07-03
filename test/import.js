var proxyquire = require('proxyquire'),
    https      = require('https'),
    events     = require('events'),
    Mixpanel   = require('../lib/mixpanel-node');

var mock_now_time = new Date(2016, 1, 1).getTime(),
    six_days_ago_timestamp = mock_now_time - 1000 * 60 * 60 * 24 * 6;

describe('import', () => {
    let mixpanel;
    beforeEach(() => {
        mixpanel = Mixpanel.init('token', { secret: 'my api secret' });

        vi.spyOn(mixpanel, 'send_request');

        return () => {
            mixpanel.send_request.mockRestore();
        }
    });

    it('calls send_request with correct endpoint and data', () => {
        var event = 'test',
            time = six_days_ago_timestamp,
            props = { key1: 'val1' },
            expected_endpoint = '/import',
            expected_data = {
                event: 'test',
                properties: expect.objectContaining({
                    key1: 'val1',
                    token: 'token',
                    time: time,
                }),
            };

        mixpanel.import(event, time, props);

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            expect.objectContaining({
                endpoint: expected_endpoint,
                data: expected_data,
            }),
            undefined,
        );
    });

    it('supports a Date instance greater than 5 days old', () => {
        var event = 'test',
            time = new Date(six_days_ago_timestamp),
            props = { key1: 'val1' },
            expected_endpoint = '/import',
            expected_data = {
                event: 'test',
                properties: expect.objectContaining({
                    key1: 'val1',
                    token: 'token',
                    time: six_days_ago_timestamp,
                }),
            };

        mixpanel.import(event, time, props);

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            expect.objectContaining({
                endpoint: expected_endpoint,
                data: expected_data,
            }),
            undefined,
        );
    });

    it('supports a Date instance less than 5 days old', () => {
        var event = 'test',
            time = new Date(mock_now_time),
            props = { key1: 'val1' },
            expected_endpoint = '/import',
            expected_data = {
                event: 'test',
                properties: expect.objectContaining({
                    key1: 'val1',
                    token: 'token',
                    time: mock_now_time,
                }),
            };

        mixpanel.import(event, time, props);

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            expect.objectContaining({
                endpoint: expected_endpoint,
                data: expected_data,
            }),
            undefined,
        );
    });

    it('supports a unix timestamp', () => {
        var event = 'test',
            time = mock_now_time,
            props = { key1: 'val1' },
            expected_endpoint = '/import',
            expected_data = {
                event: 'test',
                properties: expect.objectContaining({
                    key1: 'val1',
                    token: 'token',
                    time: time,
                }),
            };

        mixpanel.import(event, time, props);
        expect(mixpanel.send_request).toHaveBeenCalledWith(
            expect.objectContaining({
                endpoint: expected_endpoint,
                data: expected_data,
            }),
            undefined,
        );
    });

    it('requires the time argument to be a number or Date', () => {
        expect(() => mixpanel.import('test', new Date())).not.toThrowError();
        expect(() => mixpanel.import('test', Date.now())).not.toThrowError();
        expect(() => mixpanel.import('test', 'not a number or Date')).toThrowError(
            /`time` property must be a Date or Unix timestamp/,
        );
        expect(() => mixpanel.import('test')).toThrowError(
            /`time` property must be a Date or Unix timestamp/,
        );
    });
});

describe('import_batch', () => {
    let mixpanel;
    beforeEach(() => {
        mixpanel = Mixpanel.init('token', { secret: 'my api secret' });

        vi.spyOn(mixpanel, 'send_request');

        return () => {
            mixpanel.send_request.mockRestore();
        };
    });

    it('calls send_request with correct endpoint, data, and method', () => {
        var expected_endpoint = '/import',
            event_list = [
                {event: 'test',  properties: {key1: 'val1', time: 500 }},
                {event: 'test',  properties: {key2: 'val2', time: 1000}},
                {event: 'test2', properties: {key2: 'val2', time: 1500}},
            ],
            expected_data = [
                {event: 'test',  properties: {key1: 'val1', time: 500,  token: 'token'}},
                {event: 'test',  properties: {key2: 'val2', time: 1000, token: 'token'}},
                {event: 'test2', properties: {key2: 'val2', time: 1500, token: 'token'}},
            ];

        mixpanel.import_batch(event_list);

        expect(mixpanel.send_request).toHaveBeenCalledWith(
            {
                method: 'POST',
                endpoint: expected_endpoint,
                data: expected_data,
            },
            expect.any(Function)
        );
    });

    it('requires the time argument for every event', () => {
        var event_list = [
            { event: 'test', properties: { key1: 'val1', time: 500  } },
            { event: 'test', properties: { key2: 'val2', time: 1000 } },
            { event: 'test2', properties: { key2: 'val2'            } },
        ];
        expect(() => mixpanel.import_batch(event_list)).toThrowError(
            '`time` property must be a Date or Unix timestamp and is only required for `import` endpoint',
        );
    });

    it('batches 50 events at a time', () => {
        var event_list = [];
        for (var ei = 0; ei < 130; ei++) { // 3 batches: 50 + 50 + 30
            event_list.push({
                event: 'test',
                properties: { key1: 'val1', time: 500 + ei },
            });
        }

        mixpanel.import_batch(event_list);
        expect(mixpanel.send_request).toHaveBeenCalledTimes(3);
    });
});

describe('import_batch_integration', () => {
    let mixpanel;
    let http_emitter;
    let event_list;
    let res;
    beforeEach(() => {
        mixpanel = Mixpanel.init('token', { secret: 'my api secret' });

        vi.spyOn(https, 'request');

        http_emitter = new events.EventEmitter();

        // stub sequence of https responses
        res = [];
        for (let ri = 0; ri < 5; ri++) {
            res.push(new events.EventEmitter());
            https.request.mockImplementationOnce((_, cb) => {
                cb(res[ri]);
                return {
                    write: () => {},
                    end: () => {},
                    on: (event) => {},
                };
            });
        }

        event_list = [];
        for (var ei = 0; ei < 130; ei++) { // 3 batches: 50 + 50 + 30
            event_list.push({
                event: 'test',
                properties: { key1: 'val1', time: 500 + ei },
            });
        }

        return () => {
            https.request.mockRestore();
        }
    });

    it('calls provided callback after all requests finish', () => {
        mixpanel.import_batch(event_list, function (error_list) {
            expect(https.request).toHaveBeenCalledTimes(3);
            expect(error_list).toBe(null);
        });
        for (var ri = 0; ri < 3; ri++) {
            res[ri].emit('data', '1');
            res[ri].emit('end');
        }
    });

    it('passes error list to callback', () => {
        mixpanel.import_batch(event_list, function (error_list) {
            expect(error_list.length).toBe(3);
        });
        for (var ri = 0; ri < 3; ri++) {
            res[ri].emit('data', '0');
            res[ri].emit('end');
        }
    });

    it('calls provided callback when options are passed', () => {
        mixpanel.import_batch(event_list, { max_batch_size: 100 }, function (error_list) {
            expect(https.request).toHaveBeenCalledTimes(3);
            expect(error_list).toBe(null);
        });
        for (var ri = 0; ri < 3; ri++) {
            res[ri].emit('data', '1');
            res[ri].emit('end');
        }
    });

    it('sends more requests when max_batch_size < 50', () => {
        mixpanel.import_batch(event_list, { max_batch_size: 30 }, function (error_list) {
            expect(https.request).toHaveBeenCalledTimes(5); // 30 + 30 + 30 + 30 + 10
            expect(error_list).toBe(null);
        });
        for (var ri = 0; ri < 5; ri++) {
            res[ri].emit('data', '1');
            res[ri].emit('end');
        }
    });

    it('can set max concurrent requests', () => {
        var async_all_stub = vi.fn();
        var PatchedMixpanel = proxyquire('../lib/mixpanel-node', {
            './utils': { async_all: async_all_stub },
        });
        async_all_stub.mockImplementationOnce((_, __, cb) => cb(null));
        mixpanel = PatchedMixpanel.init('token', { secret: 'my api secret' });

        mixpanel.import_batch(
            event_list,
            { max_batch_size: 30, max_concurrent_requests: 2 },
            function (error_list) {
                // should send 5 event batches over 3 request batches:
                // request batch 1: 30 events, 30 events
                // request batch 2: 30 events, 30 events
                // request batch 3: 10 events
                expect(async_all_stub).toHaveBeenCalledTimes(3);
                expect(error_list).toBe(null);
            },
        );
        for (var ri = 0; ri < 5; ri++) {
            res[ri].emit('data', '1');
            res[ri].emit('end');
        }
    });

    it('behaves well without a callback', () => {
        mixpanel.import_batch(event_list);
        expect(https.request).toHaveBeenCalledTimes(3);
        mixpanel.import_batch(event_list, { max_batch_size: 100 });
        expect(https.request).toHaveBeenCalledTimes(5);
    });
});
