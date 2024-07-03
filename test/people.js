const Mixpanel = require('../lib/mixpanel-node');
const {create_profile_helpers} = require('../lib/profile_helpers');

describe('people', () => {
    const endpoint = '/engage';
    const distinct_id = 'user1';
    const token = 'token';
    let mixpanel;
    beforeEach(() => {
        mixpanel = Mixpanel.init(token);
        vi.spyOn(mixpanel, 'send_request')

        return () => {
          mixpanel.send_request.mockRestore();
        }
    });

    // shared test case
    const test_send_request_args = function(func, {args, expected, use_modifiers, use_callback} = {}) {
        let expected_data = {$token: token, $distinct_id: distinct_id, ...expected};
        let callback;

        args = [distinct_id, ...(args ? args : [])];

        if (use_modifiers) {
            var modifiers = {
                '$ignore_alias': true,
                '$ignore_time': true,
                '$ip': '1.2.3.4',
                '$time': 1234567890,
                '$latitude': 40.7127753,
                '$longitude': -74.0059728,
            };
            Object.assign(expected_data, modifiers);
            args.push(modifiers);
        }
        if (use_callback) {
            callback = function() {};
            args.push(callback);
        }

        mixpanel.people[func](...args);

        const expectedSendRequestArgs = [
            { method: 'GET', endpoint, data: expected_data },
            use_callback ? callback : undefined,
        ];
        expect(mixpanel.send_request).toHaveBeenCalledWith(...expectedSendRequestArgs)
    };

    describe("_set", () => {
        it("handles set_once correctly", () => {
            test_send_request_args('set_once', {
                args: ['key1', 'val1'],
                expected: {$set_once: {'key1': 'val1'}},
            });
        });

        it("calls send_request with correct endpoint and data", () =>  {
            test_send_request_args('set', {
                args: ['key1', 'val1'],
                expected: {$set: {'key1': 'val1'}},
            });
        });

        it("supports being called with a property object", () =>  {
            test_send_request_args('set', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set: {'key1': 'val1', 'key2': 'val2'}},
            });
        });

        it("supports being called with a property object (set_once)", () =>  {
            test_send_request_args('set_once', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set_once: {'key1': 'val1', 'key2': 'val2'}},
            });
        });

        it("supports being called with a modifiers argument", () =>  {
            test_send_request_args('set', {
                args: ['key1', 'val1'],
                expected: {$set: {'key1': 'val1'}},
                use_modifiers: true,
            });
        });

        it("supports being called with a modifiers argument (set_once)", () =>  {
            test_send_request_args('set_once', {
                args: ['key1', 'val1'],
                expected: {$set_once: {'key1': 'val1'}},
                use_modifiers: true,
            });
        });

        it("supports being called with a properties object and a modifiers argument", () =>  {
            test_send_request_args('set', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set: {'key1': 'val1', 'key2': 'val2'}},
                use_modifiers: true,
            });
        });

        it("supports being called with a properties object and a modifiers argument (set_once)", () =>  {
            test_send_request_args('set_once', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set_once: {'key1': 'val1', 'key2': 'val2'}},
                use_modifiers: true,
            });
        });

        it("handles the ip property in a property object properly", () =>  {
            test_send_request_args('set', {
                args: [{'ip': '1.2.3.4', 'key1': 'val1', 'key2': 'val2'}],
                expected: {
                    $ip: '1.2.3.4',
                    $set: {'key1': 'val1', 'key2': 'val2'},
                },
            });
        });

        it("handles the $ignore_time property in a property object properly", () =>  {
            test_send_request_args('set', {
                args: [{'$ignore_time': true, 'key1': 'val1', 'key2': 'val2'}],
                expected: {
                    $ignore_time: true,
                    $set: {'key1': 'val1', 'key2': 'val2'},
                },
            });
        });

        it("supports being called with a callback", () =>  {
            test_send_request_args('set', {
                args: ['key1', 'val1'],
                expected: {$set: {'key1': 'val1'}},
                use_callback: true,
            });
        });

        it("supports being called with a callback (set_once)", () =>  {
            test_send_request_args('set_once', {
                args: ['key1', 'val1'],
                expected: {$set_once: {'key1': 'val1'}},
                use_callback: true,
            });
        });

        it("supports being called with a properties object and a callback", () =>  {
            test_send_request_args('set', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set: {'key1': 'val1', 'key2': 'val2'}},
                use_callback: true,
            });
        });

        it("supports being called with a properties object and a callback (set_once)", () =>  {
            test_send_request_args('set_once', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set_once: {'key1': 'val1', 'key2': 'val2'}},
                use_callback: true,
            });
        });

        it("supports being called with a modifiers argument and a callback", () =>  {
            test_send_request_args('set', {
                args: ['key1', 'val1'],
                expected: {$set: {'key1': 'val1'}},
                use_callback: true,
                use_modifiers: true,
            });
        });

        it("supports being called with a modifiers argument and a callback (set_once)", () =>  {
            test_send_request_args('set_once', {
                args: ['key1', 'val1'],
                expected: {$set_once: {'key1': 'val1'}},
                use_callback: true,
                use_modifiers: true,
            });
        });

        it("supports being called with a properties object, a modifiers argument and a callback", () =>  {
            test_send_request_args('set', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set: {'key1': 'val1', 'key2': 'val2'}},
                use_callback: true,
                use_modifiers: true,
            });
        });

        it("supports being called with a properties object, a modifiers argument and a callback (set_once)", () =>  {
            test_send_request_args('set_once', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set_once: {'key1': 'val1', 'key2': 'val2'}},
                use_callback: true,
                use_modifiers: true,
            });
        });
    });

    describe("increment", () => {
        it("calls send_request with correct endpoint and data", () => {
            test_send_request_args('increment', {
                args: ['key1'],
                expected: {$add: {'key1': 1}},
            });
        });

        it("supports incrementing key by value", () => {
            test_send_request_args('increment', {
                args: ['key1', 2],
                expected: {$add: {'key1': 2}},
            });
        });

        it("supports incrementing key by value and a modifiers argument", () => {
            test_send_request_args('increment', {
                args: ['key1', 2],
                expected: {$add: {'key1': 2}},
                use_modifiers: true,
            });
        });

        it("supports incrementing multiple keys", () => {
            test_send_request_args('increment', {
                args: [{'key1': 5, 'key2': -3}],
                expected: {$add: {'key1': 5, 'key2': -3}},
            });
        });

        it("supports incrementing multiple keys and a modifiers argument", () => {
            test_send_request_args('increment', {
                args: [{'key1': 5, 'key2': -3}],
                expected: {$add: {'key1': 5, 'key2': -3}},
                use_modifiers: true,
            });
        });

        it("ignores invalid values", () => {
            test_send_request_args('increment', {
                args: [{
                    'key1': 'bad',
                    'key2': 3,
                    'key3': undefined,
                    'key4': '5',
                    'key5': new Date(),
                    'key6': function() {},
                }],
                expected: {$add: {'key2': 3, 'key4': '5'}},
            });
        });

        it("supports being called with a callback", () => {
            test_send_request_args('increment', {
                args: ['key1'],
                expected: {$add: {'key1': 1}},
                use_callback: true,
            });
        });

        it("supports incrementing key by value with a callback", () => {
            test_send_request_args('increment', {
                args: ['key1', 2],
                expected: {$add: {'key1': 2}},
                use_callback: true,
            });
        });

        it("supports incrementing key by value with a modifiers argument and callback", () => {
            test_send_request_args('increment', {
                args: ['key1', 2],
                expected: {$add: {'key1': 2}},
                use_callback: true,
                use_modifiers: true,
            });
        });

        it("supports incrementing multiple keys with a callback", () => {
            test_send_request_args('increment', {
                args: [{'key1': 5, 'key2': -3}],
                expected: {$add: {'key1': 5, 'key2': -3}},
                use_callback: true,
            });
        });

        it("supports incrementing multiple keys with a modifiers argument and callback", () => {
            test_send_request_args('increment', {
                args: [{'key1': 5, 'key2': -3}],
                expected: {$add: {'key1': 5, 'key2': -3}},
                use_callback: true,
                use_modifiers: true,
            });
        });
    });

    describe("append", () => {
        it("calls send_request with correct endpoint and data", () => {
            test_send_request_args('append', {
                args: ['key1', 'value'],
                expected: {$append: {'key1': 'value'}},
            });
        });

        it("supports being called with modifiers", () => {
            test_send_request_args('append', {
                args: ['key1', 'value'],
                expected: {$append: {'key1': 'value'}},
                use_modifiers: true,
            });
        });

        it("supports being called with a callback", () => {
            test_send_request_args('append', {
                args: ['key1', 'value'],
                expected: {$append: {'key1': 'value'}},
                use_callback: true,
            });
        });

        it("supports appending multiple keys with values", () => {
            test_send_request_args('append', {
                args: [{'key1': 'value1', 'key2': 'value2'}],
                expected: {$append: {'key1': 'value1', 'key2': 'value2'}},
            });
        });

        it("supports appending multiple keys with values and a modifiers argument", () => {
            test_send_request_args('append', {
                args: [{'key1': 'value1', 'key2': 'value2'}],
                expected: {$append: {'key1': 'value1', 'key2': 'value2'}},
                use_modifiers: true,
            });
        });

        it("supports appending multiple keys with values and a callback", () => {
            test_send_request_args('append', {
                args: [{'key1': 'value1', 'key2': 'value2'}],
                expected: {$append: {'key1': 'value1', 'key2': 'value2'}},
                use_callback: true,
            });
        });

        it("supports appending multiple keys with values with a modifiers argument and callback", () => {
            test_send_request_args('append', {
                args: [{'key1': 'value1', 'key2': 'value2'}],
                expected: {$append: {'key1': 'value1', 'key2': 'value2'}},
                use_callback: true,
                use_modifiers: true,
            });
        });
    });

    describe("track_charge", () => {
        it("calls send_request with correct endpoint and data", () => {
            test_send_request_args('track_charge', {
                args: [50],
                expected: {$append: {$transactions: {$amount: 50}}},
            });
        });

        it("supports being called with a property object", () => {
            var time = new Date('Feb 1 2012');
            test_send_request_args('track_charge', {
                args: [50, {$time: time, isk: 'isk'}],
                expected: {$append: {$transactions: {
                    $amount: 50,
                    $time:   time.toISOString(),
                    isk:     'isk',
                }}},
            });
        });

        it("supports being called with a modifiers argument", () => {
            test_send_request_args('track_charge', {
                args: [50],
                expected: {$append: {$transactions: {$amount: 50}}},
                use_modifiers: true,
            });
        });

        it("supports being called with a property object and a modifiers argument", () => {
            var time = new Date('Feb 1 2012');
            test_send_request_args('track_charge', {
                args: [50, {$time: time, isk: 'isk'}],
                expected: {$append: {$transactions: {
                    $amount: 50,
                    $time:   time.toISOString(),
                    isk:     'isk',
                }}},
                use_modifiers: true,
            });
        });

        it("supports being called with a callback", () => {
            test_send_request_args('track_charge', {
                args: [50],
                expected: {$append: {$transactions: {$amount: 50}}},
                use_callback: true,
            });
        });

        it("supports being called with properties and a callback", () => {
            test_send_request_args('track_charge', {
                args: [50, {}],
                expected: {$append: {$transactions: {$amount: 50}}},
                use_callback: true,
            });
        });

        it("supports being called with modifiers and a callback", () => {
            test_send_request_args('track_charge', {
                args: [50],
                expected: {$append: {$transactions: {$amount: 50}}},
                use_callback: true,
                use_modifiers: true,
            });
        });

        it("supports being called with properties, modifiers and a callback", () => {
            var time = new Date('Feb 1 2012');
            test_send_request_args('track_charge', {
                args: [50, {$time: time, isk: 'isk'}],
                expected: {$append: {$transactions: {
                    $amount: 50,
                    $time:   time.toISOString(),
                    isk:     'isk',
                }}},
                use_callback: true,
                use_modifiers: true,
            });
        });
    });

    describe("clear_charges", () => {
        it("calls send_request with correct endpoint and data", () => {
            test_send_request_args('clear_charges', {
                expected: {$set: {$transactions: []}},
            });
        });

        it("supports being called with a modifiers argument", () => {
            test_send_request_args('clear_charges', {
                expected: {$set: {$transactions: []}},
                use_modifiers: true,
            });
        });

        it("supports being called with a callback", () => {
            test_send_request_args('clear_charges', {
                expected: {$set: {$transactions: []}},
                use_callback: true,
            });
        });

        it("supports being called with a modifiers argument and a callback", () => {
            test_send_request_args('clear_charges', {
                expected: {$set: {$transactions: []}},
                use_callback: true,
                use_modifiers: true,
            });
        });
    });

    describe("delete_user", () => {
        it("calls send_request with correct endpoint and data", () => {
            test_send_request_args('delete_user', {
                expected: {$delete: ''},
            });
        });

        it("supports being called with a modifiers argument", () => {
            test_send_request_args('delete_user', {
                expected: {$delete: ''},
                use_modifiers: true,
            });
        });

        it("supports being called with a callback", () => {
            test_send_request_args('delete_user', {
                expected: {$delete: ''},
                use_callback: true,
            });
        });

        it("supports being called with a modifiers argument and a callback", () => {
            test_send_request_args('delete_user', {
                expected: {$delete: ''},
                use_callback: true,
                use_modifiers: true,
            });
        });
    });

    describe("remove", () => {
        it("calls send_request with correct endpoint and data", () => {
            test_send_request_args('remove', {
                args: [{'key1': 'value1', 'key2': 'value2'}],
                expected: {$remove: {'key1': 'value1', 'key2': 'value2'}},
            });
        });

        it("errors on non-scalar argument types", () => {
            mixpanel.people.remove(distinct_id, {'key1': ['value1']});
            mixpanel.people.remove(distinct_id, {key1: {key: 'val'}});
            mixpanel.people.remove(distinct_id, 1231241.123);
            mixpanel.people.remove(distinct_id, [5]);
            mixpanel.people.remove(distinct_id, {key1: function() {}});
            mixpanel.people.remove(distinct_id, {key1: [function() {}]});

            expect(mixpanel.send_request).not.toHaveBeenCalled();
        });

        it("supports being called with a modifiers argument", () => {
            test_send_request_args('remove', {
                args: [{'key1': 'value1'}],
                expected: {$remove: {'key1': 'value1'}},
                use_modifiers: true,
            });
        });

        it("supports being called with a callback", () => {
            test_send_request_args('remove', {
                args: [{'key1': 'value1'}],
                expected: {$remove: {'key1': 'value1'}},
                use_callback: true,
            });
        });

        it("supports being called with a modifiers argument and a callback", () => {
            test_send_request_args('remove', {
                args: [{'key1': 'value1'}],
                expected: {$remove: {'key1': 'value1'}},
                use_callback: true,
                use_modifiers: true,
            });
        });
    });

    describe("union", () => {
        it("calls send_request with correct endpoint and data", () => {
            test_send_request_args('union', {
                args: [{'key1': ['value1', 'value2']}],
                expected: {$union: {'key1': ['value1', 'value2']}},
            });
        });

        it("supports being called with a scalar value", () => {
            test_send_request_args('union', {
                args: [{'key1': 'value1'}],
                expected: {$union: {'key1': ['value1']}},
            });
        });

        it("errors on other argument types", () => {
            mixpanel.people.union(distinct_id, {key1: {key: 'val'}});
            mixpanel.people.union(distinct_id, 1231241.123);
            mixpanel.people.union(distinct_id, [5]);
            mixpanel.people.union(distinct_id, {key1: function() {}});
            mixpanel.people.union(distinct_id, {key1: [function() {}]});

            expect(mixpanel.send_request).not.toHaveBeenCalled();
        });

        it("supports being called with a modifiers argument", () => {
            test_send_request_args('union', {
                args: [{'key1': ['value1', 'value2']}],
                expected: {$union: {'key1': ['value1', 'value2']}},
                use_modifiers: true,
            });
        });

        it("supports being called with a callback", () => {
            test_send_request_args('union', {
                args: [{'key1': ['value1', 'value2']}],
                expected: {$union: {'key1': ['value1', 'value2']}},
                use_callback: true,
            });
        });

        it("supports being called with a modifiers argument and a callback", () => {
            test_send_request_args('union', {
                args: [{'key1': ['value1', 'value2']}],
                expected: {$union: {'key1': ['value1', 'value2']}},
                use_callback: true,
                use_modifiers: true,
            });
        });
    });

    describe("unset", () => {
        it("calls send_request with correct endpoint and data", () => {
            test_send_request_args('unset', {
                args: ['key1'],
                expected: {$unset: ['key1']},
            });
        });

        it("supports being called with a property array", () => {
            test_send_request_args('unset', {
                args: [['key1', 'key2']],
                expected: {$unset: ['key1', 'key2']},
            });
        });

        it("errors on other argument types", () => {
            mixpanel.people.unset(distinct_id, { key1:'val1', key2:'val2' });
            mixpanel.people.unset(distinct_id, 1231241.123);

            expect(mixpanel.send_request).not.toHaveBeenCalled();
        });

        it("supports being called with a modifiers argument", () => {
            test_send_request_args('unset', {
                args: ['key1'],
                expected: {$unset: ['key1']},
                use_modifiers: true,
            });
        });

        it("supports being called with a callback", () => {
            test_send_request_args('unset', {
                args: ['key1'],
                expected: {$unset: ['key1']},
                use_callback: true,
            });
        });

        it("supports being called with a modifiers argument and a callback", () => {
            test_send_request_args('unset', {
                args: ['key1'],
                expected: {$unset: ['key1']},
                use_callback: true,
                use_modifiers: true,
            });
        });
    });
});
