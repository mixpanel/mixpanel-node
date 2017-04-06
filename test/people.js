var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon'),
    http        = require('http'),
    events      = require('events');

// shared test case
var test_send_request_args = function(test, func, options) {
    var expected_data = {
            $token: this.token,
            $distinct_id: this.distinct_id,
        };
    for (var k in options.expected) {
        expected_data[k] = options.expected[k];
    }
    var args = [this.distinct_id].concat(options.args || []);

    if (options.use_modifiers) {
        var modifiers = {
            '$ignore_alias': true,
            '$ignore_time': true,
            '$ip': '1.2.3.4',
            '$time': 1234567890
        };
        for (k in modifiers) {
            expected_data[k] = modifiers[k];
        }
        args.push(modifiers);
    }
    if (options.use_callback) {
        var callback = function() {};
        args.push(callback);
    }

    this.mixpanel.people[func].apply(this.mixpanel.people, args);

    test.ok(
        this.mixpanel.send_request.calledWithMatch({ method: 'GET', endpoint: this.endpoint, data: expected_data }),
        "people." + func + " didn't call send_request with correct arguments"
    );
    if (options.use_callback) {
        test.ok(
            this.mixpanel.send_request.args[0][1] === callback,
            "people.set didn't call send_request with a callback"
        );
    }
    test.done();
};

exports.people = {
    setUp: function(next) {
        this.token = 'token';
        this.mixpanel = Mixpanel.init(this.token);

        Sinon.stub(this.mixpanel, 'send_request');

        this.distinct_id = "user1";
        this.endpoint = "/engage";

        this.test_send_request_args = test_send_request_args;

        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_request.restore();

        next();
    },

    _set: {
        "handles set_once correctly": function(test){
            this.test_send_request_args(test, 'set_once', {
                args: ['key1', 'val1'],
                expected: {$set_once: {'key1': 'val1'}},
            });
        },

        "calls send_request with correct endpoint and data": function(test) {
            this.test_send_request_args(test, 'set', {
                args: ['key1', 'val1'],
                expected: {$set: {'key1': 'val1'}},
            });
        },

        "supports being called with a property object": function(test) {
            this.test_send_request_args(test, 'set', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set: {'key1': 'val1', 'key2': 'val2'}},
            });
        },

        "supports being called with a property object (set_once)": function(test) {
            this.test_send_request_args(test, 'set_once', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set_once: {'key1': 'val1', 'key2': 'val2'}},
            });
        },

        "supports being called with a modifiers argument": function(test) {
            this.test_send_request_args(test, 'set', {
                args: ['key1', 'val1'],
                expected: {$set: {'key1': 'val1'}},
                use_modifiers: true,
            });
        },

        "supports being called with a modifiers argument (set_once)": function(test) {
            this.test_send_request_args(test, 'set_once', {
                args: ['key1', 'val1'],
                expected: {$set_once: {'key1': 'val1'}},
                use_modifiers: true,
            });
        },

        "supports being called with a properties object and a modifiers argument": function(test) {
            this.test_send_request_args(test, 'set', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set: {'key1': 'val1', 'key2': 'val2'}},
                use_modifiers: true,
            });
        },

        "supports being called with a properties object and a modifiers argument (set_once)": function(test) {
            this.test_send_request_args(test, 'set_once', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set_once: {'key1': 'val1', 'key2': 'val2'}},
                use_modifiers: true,
            });
        },

        "handles the ip property in a property object properly": function(test) {
            this.test_send_request_args(test, 'set', {
                args: [{'ip': '1.2.3.4', 'key1': 'val1', 'key2': 'val2'}],
                expected: {
                    $ip: '1.2.3.4',
                    $set: {'key1': 'val1', 'key2': 'val2'},
                },
            });
        },

        "handles the $ignore_time property in a property object properly": function(test) {
            this.test_send_request_args(test, 'set', {
                args: [{'$ignore_time': true, 'key1': 'val1', 'key2': 'val2'}],
                expected: {
                    $ignore_time: true,
                    $set: {'key1': 'val1', 'key2': 'val2'},
                },
            });
        },

        "supports being called with a callback": function(test) {
            this.test_send_request_args(test, 'set', {
                args: ['key1', 'val1'],
                expected: {$set: {'key1': 'val1'}},
                use_callback: true,
            });
        },

        "supports being called with a callback (set_once)": function(test) {
            this.test_send_request_args(test, 'set_once', {
                args: ['key1', 'val1'],
                expected: {$set_once: {'key1': 'val1'}},
                use_callback: true,
            });
        },

        "supports being called with a properties object and a callback": function(test) {
            this.test_send_request_args(test, 'set', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set: {'key1': 'val1', 'key2': 'val2'}},
                use_callback: true,
            });
        },

        "supports being called with a properties object and a callback (set_once)": function(test) {
            this.test_send_request_args(test, 'set_once', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set_once: {'key1': 'val1', 'key2': 'val2'}},
                use_callback: true,
            });
        },

        "supports being called with a modifiers argument and a callback": function(test) {
            this.test_send_request_args(test, 'set', {
                args: ['key1', 'val1'],
                expected: {$set: {'key1': 'val1'}},
                use_callback: true,
                use_modifiers: true,
            });
        },

        "supports being called with a modifiers argument and a callback (set_once)": function(test) {
            this.test_send_request_args(test, 'set_once', {
                args: ['key1', 'val1'],
                expected: {$set_once: {'key1': 'val1'}},
                use_callback: true,
                use_modifiers: true,
            });
        },

        "supports being called with a properties object, a modifiers argument and a callback": function(test) {
            this.test_send_request_args(test, 'set', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set: {'key1': 'val1', 'key2': 'val2'}},
                use_callback: true,
                use_modifiers: true,
            });
        },

        "supports being called with a properties object, a modifiers argument and a callback (set_once)": function(test) {
            this.test_send_request_args(test, 'set_once', {
                args: [{'key1': 'val1', 'key2': 'val2'}],
                expected: {$set_once: {'key1': 'val1', 'key2': 'val2'}},
                use_callback: true,
                use_modifiers: true,
            });
        },
    },

    increment: {
        "calls send_request with correct endpoint and data": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: ['key1'],
                expected: {$add: {'key1': 1}},
            });
        },

        "supports incrementing key by value": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: ['key1', 2],
                expected: {$add: {'key1': 2}},
            });
        },

        "supports incrementing key by value and a modifiers argument": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: ['key1', 2],
                expected: {$add: {'key1': 2}},
                use_modifiers: true,
            });
        },

        "supports incrementing multiple keys": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: [{'key1': 5, 'key2': -3}],
                expected: {$add: {'key1': 5, 'key2': -3}},
            });
        },

        "supports incrementing multiple keys and a modifiers argument": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: [{'key1': 5, 'key2': -3}],
                expected: {$add: {'key1': 5, 'key2': -3}},
                use_modifiers: true,
            });
        },

        "ignores invalid values": function(test) {
            this.test_send_request_args(test, 'increment', {
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
        },

        "supports being called with a callback": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: ['key1'],
                expected: {$add: {'key1': 1}},
                use_callback: true,
            });
        },

        "supports incrementing key by value with a callback": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: ['key1', 2],
                expected: {$add: {'key1': 2}},
                use_callback: true,
            });
        },

        "supports incrementing key by value with a modifiers argument and callback": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: ['key1', 2],
                expected: {$add: {'key1': 2}},
                use_callback: true,
                use_modifiers: true,
            });
        },

        "supports incrementing multiple keys with a callback": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: [{'key1': 5, 'key2': -3}],
                expected: {$add: {'key1': 5, 'key2': -3}},
                use_callback: true,
            });
        },

        "supports incrementing multiple keys with a modifiers argument and callback": function(test) {
            this.test_send_request_args(test, 'increment', {
                args: [{'key1': 5, 'key2': -3}],
                expected: {$add: {'key1': 5, 'key2': -3}},
                use_callback: true,
                use_modifiers: true,
            });
        },
    },

    append: {
        "calls send_request with correct endpoint and data": function(test) {
            this.test_send_request_args(test, 'append', {
                args: ['key1', 'value'],
                expected: {$append: {'key1': 'value'}},
            });
        },

        "supports being called with modifiers": function(test) {
            this.test_send_request_args(test, 'append', {
                args: ['key1', 'value'],
                expected: {$append: {'key1': 'value'}},
                use_modifiers: true,
            });
        },

        "supports being called with a callback": function(test) {
            this.test_send_request_args(test, 'append', {
                args: ['key1', 'value'],
                expected: {$append: {'key1': 'value'}},
                use_callback: true,
            });
        },

        "supports appending multiple keys with values": function(test) {
            this.test_send_request_args(test, 'append', {
                args: [{'key1': 'value1', 'key2': 'value2'}],
                expected: {$append: {'key1': 'value1', 'key2': 'value2'}},
            });
        },

        "supports appending multiple keys with values and a modifiers argument": function(test) {
            this.test_send_request_args(test, 'append', {
                args: [{'key1': 'value1', 'key2': 'value2'}],
                expected: {$append: {'key1': 'value1', 'key2': 'value2'}},
                use_modifiers: true,
            });
        },

        "supports appending multiple keys with values and a callback": function(test) {
            this.test_send_request_args(test, 'append', {
                args: [{'key1': 'value1', 'key2': 'value2'}],
                expected: {$append: {'key1': 'value1', 'key2': 'value2'}},
                use_callback: true,
            });
        },

        "supports appending multiple keys with values with a modifiers argument and callback": function(test) {
            this.test_send_request_args(test, 'append', {
                args: [{'key1': 'value1', 'key2': 'value2'}],
                expected: {$append: {'key1': 'value1', 'key2': 'value2'}},
                use_callback: true,
                use_modifiers: true,
            });
        },
    },

    track_charge: {
        "calls send_request with correct endpoint and data": function(test) {
            this.test_send_request_args(test, 'track_charge', {
                args: [50],
                expected: {$append: {$transactions: {$amount: 50}}},
            });
        },

        "supports being called with a property object": function(test) {
            var time = new Date('Feb 1 2012');
            this.test_send_request_args(test, 'track_charge', {
                args: [50, {$time: time, isk: 'isk'}],
                expected: {$append: {$transactions: {
                    $amount: 50,
                    $time:   time.toISOString(),
                    isk:     'isk',
                }}},
            });
        },

        "supports being called with a modifiers argument": function(test) {
            this.test_send_request_args(test, 'track_charge', {
                args: [50],
                expected: {$append: {$transactions: {$amount: 50}}},
                use_modifiers: true,
            });
        },

        "supports being called with a property object and a modifiers argument": function(test) {
            var time = new Date('Feb 1 2012');
            this.test_send_request_args(test, 'track_charge', {
                args: [50, {$time: time, isk: 'isk'}],
                expected: {$append: {$transactions: {
                    $amount: 50,
                    $time:   time.toISOString(),
                    isk:     'isk',
                }}},
                use_modifiers: true,
            });
        },

        "supports being called with a callback": function(test) {
            this.test_send_request_args(test, 'track_charge', {
                args: [50],
                expected: {$append: {$transactions: {$amount: 50}}},
                use_callback: true,
            });
        },

        "supports being called with properties and a callback": function(test) {
            this.test_send_request_args(test, 'track_charge', {
                args: [50, {}],
                expected: {$append: {$transactions: {$amount: 50}}},
                use_callback: true,
            });
        },

        "supports being called with modifiers and a callback": function(test) {
            this.test_send_request_args(test, 'track_charge', {
                args: [50],
                expected: {$append: {$transactions: {$amount: 50}}},
                use_callback: true,
                use_modifiers: true,
            });
        },

        "supports being called with properties, modifiers and a callback": function(test) {
            var time = new Date('Feb 1 2012');
            this.test_send_request_args(test, 'track_charge', {
                args: [50, {$time: time, isk: 'isk'}],
                expected: {$append: {$transactions: {
                    $amount: 50,
                    $time:   time.toISOString(),
                    isk:     'isk',
                }}},
                use_callback: true,
                use_modifiers: true,
            });
        },
    },

    clear_charges: {
        "calls send_request with correct endpoint and data": function(test) {
            this.test_send_request_args(test, 'clear_charges', {
                expected: {$set: {$transactions: []}},
            });
        },

        "supports being called with a modifiers argument": function(test) {
            this.test_send_request_args(test, 'clear_charges', {
                expected: {$set: {$transactions: []}},
                use_modifiers: true,
            });
        },

        "supports being called with a callback": function(test) {
            this.test_send_request_args(test, 'clear_charges', {
                expected: {$set: {$transactions: []}},
                use_callback: true,
            });
        },

        "supports being called with a modifiers argument and a callback": function(test) {
            this.test_send_request_args(test, 'clear_charges', {
                expected: {$set: {$transactions: []}},
                use_callback: true,
                use_modifiers: true,
            });
        },
    },

    delete_user: {
        "calls send_request with correct endpoint and data": function(test) {
            this.test_send_request_args(test, 'delete_user', {
                expected: {$delete: ''},
            });
        },

        "supports being called with a modifiers argument": function(test) {
            this.test_send_request_args(test, 'delete_user', {
                expected: {$delete: ''},
                use_modifiers: true,
            });
        },

        "supports being called with a callback": function(test) {
            this.test_send_request_args(test, 'delete_user', {
                expected: {$delete: ''},
                use_callback: true,
            });
        },

        "supports being called with a modifiers argument and a callback": function(test) {
            this.test_send_request_args(test, 'delete_user', {
                expected: {$delete: ''},
                use_callback: true,
                use_modifiers: true,
            });
        },
    },

    union: {
        "calls send_request with correct endpoint and data": function(test) {
            this.test_send_request_args(test, 'union', {
                args: [{'key1': ['value1', 'value2']}],
                expected: {$union: {'key1': ['value1', 'value2']}},
            });
        },

        "supports being called with a scalar value": function(test) {
            this.test_send_request_args(test, 'union', {
                args: [{'key1': 'value1'}],
                expected: {$union: {'key1': ['value1']}},
            });
        },

        "errors on other argument types": function(test) {
            this.mixpanel.people.union(this.distinct_id, {key1: {key: 'val'}});
            this.mixpanel.people.union(this.distinct_id, 1231241.123);
            this.mixpanel.people.union(this.distinct_id, [5]);
            this.mixpanel.people.union(this.distinct_id, {key1: function() {}});
            this.mixpanel.people.union(this.distinct_id, {key1: [function() {}]});

            test.ok(
                !this.mixpanel.send_request.called,
                "people.union shouldn't call send_request on invalid arguments"
            );
            test.done();
        },

        "supports being called with a modifiers argument": function(test) {
            this.test_send_request_args(test, 'union', {
                args: [{'key1': ['value1', 'value2']}],
                expected: {$union: {'key1': ['value1', 'value2']}},
                use_modifiers: true,
            });
        },

        "supports being called with a callback": function(test) {
            this.test_send_request_args(test, 'union', {
                args: [{'key1': ['value1', 'value2']}],
                expected: {$union: {'key1': ['value1', 'value2']}},
                use_callback: true,
            });
        },

        "supports being called with a modifiers argument and a callback": function(test) {
            this.test_send_request_args(test, 'union', {
                args: [{'key1': ['value1', 'value2']}],
                expected: {$union: {'key1': ['value1', 'value2']}},
                use_callback: true,
                use_modifiers: true,
            });
        },
    },

    unset: {
        "calls send_request with correct endpoint and data": function(test) {
            this.test_send_request_args(test, 'unset', {
                args: ['key1'],
                expected: {$unset: ['key1']},
            });
        },

        "supports being called with a property array": function(test) {
            this.test_send_request_args(test, 'unset', {
                args: [['key1', 'key2']],
                expected: {$unset: ['key1', 'key2']},
            });
        },

        "errors on other argument types": function(test) {
            this.mixpanel.people.unset(this.distinct_id, { key1:'val1', key2:'val2' });
            this.mixpanel.people.unset(this.distinct_id, 1231241.123);

            test.ok(
                !this.mixpanel.send_request.called,
                "people.unset shouldn't call send_request on invalid arguments"
            );
            test.done();
        },

        "supports being called with a modifiers argument": function(test) {
            this.test_send_request_args(test, 'unset', {
                args: ['key1'],
                expected: {$unset: ['key1']},
                use_modifiers: true,
            });
        },

        "supports being called with a callback": function(test) {
            this.test_send_request_args(test, 'unset', {
                args: ['key1'],
                expected: {$unset: ['key1']},
                use_callback: true,
            });
        },

        "supports being called with a modifiers argument and a callback": function(test) {
            this.test_send_request_args(test, 'unset', {
                args: ['key1'],
                expected: {$unset: ['key1']},
                use_callback: true,
                use_modifiers: true,
            });
        },
    },
};

exports.track_batch = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token');
        this.clock = Sinon.useFakeTimers();
        Sinon.stub(this.mixpanel, 'send_request');
        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_request.restore();
        this.clock.restore();
        next();
    },

    "calls people.batch with correct endpoint, data, and method": function(test) {
        var expected_endpoint = "/engage",
            changes = [
                {$distinct_id: 'test',  $set: {Address: 'val1'}},
                {$distinct_id: 'test1',  $set: {Address: 'val2'}},
                {$distinct_id: 'test2',  $set: {Address: 'val3'}}
            ],
            expected_data = [
                {$distinct_id: 'test',  $set: {Address: 'val1'}, $token: 'token'},
                {$distinct_id: 'test1',  $set: {Address: 'val2'}, $token: 'token'},
                {$distinct_id: 'test2',  $set: {Address: 'val3'}, $token: 'token'}
            ];

        this.mixpanel.people.batch({changes: changes});

        test.ok(
            this.mixpanel.send_request.calledWithMatch({
                method: "post",
                endpoint: expected_endpoint,
                data: expected_data
            }),
            "people.batch didn't call send_request with correct arguments"
        );

        test.done();
    },

    "batches 50 events at a time": function(test) {
        var changes = [];
        for (var ei = 0; ei < 130; ei++) { // 3 batches: 50 + 50 + 30
            changes.push({$distinct_id: 'test',  $set: {Address: 'val1'}});
        }

        this.mixpanel.people.batch({changes: changes});

        test.equals(
            3, this.mixpanel.send_request.callCount,
            "people.batch didn't call send_request correct number of times"
        );

        test.done();
    }
};

exports.people_batch_integration = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', { key: 'key' });
        this.clock = Sinon.useFakeTimers();

        Sinon.stub(http, 'request');

        this.http_emitter = new events.EventEmitter();

        // stub sequence of http responses
        this.res = [];
        for (var ri = 0; ri < 5; ri++) {
            this.res.push(new events.EventEmitter());
            http.request
                .onCall(ri)
                .callsArgWith(1, this.res[ri])
                .returns({
                    write: function () {},
                    end: function () {},
                    on: function(event) {}
                });
        }

        this.changes = [];
        for (var ei = 0; ei < 130; ei++) { // 3 batches: 50 + 50 + 30
            this.changes.push({$distinct_id: 'test',  $set: {Address: 'val1'}});
        }

        next();
    },

    tearDown: function(next) {
        http.request.restore();
        this.clock.restore();

        next();
    },

    "calls provided callback after all requests finish": function(test) {
        test.expect(2);
        this.mixpanel.people.batch({changes: this.changes}, function(error_list) {
            test.equals(
                3, http.request.callCount,
                "people.batch didn't call send_request correct number of times before callback"
            );
            test.equals(
                null, error_list,
                "people.batch returned errors in callback unexpectedly"
            );
            test.done();
        });
        for (var ri = 0; ri < 3; ri++) {
            this.res[ri].emit('data', '1');
            this.res[ri].emit('end');
        }
    },

    "passes error list to callback": function(test) {
        test.expect(1);
        this.mixpanel.people.batch({changes: this.changes}, function(error_list) {
            test.equals(
                3, error_list.length,
                "people.batch didn't return errors in callback"
            );
            test.done();
        });
        for (var ri = 0; ri < 3; ri++) {
            this.res[ri].emit('data', '0');
            this.res[ri].emit('end');
        }
    },

    "calls provided callback when options are passed": function(test) {
        test.expect(2);
        this.mixpanel.people.batch({changes: this.changes, max_batch_size: 100}, function(error_list) {
            test.equals(
                3, http.request.callCount,
                "people.batch didn't call send_request correct number of times before callback"
            );
            test.equals(
                null, error_list,
                "people.batch returned errors in callback unexpectedly"
            );
            test.done();
        });
        for (var ri = 0; ri < 3; ri++) {
            this.res[ri].emit('data', '1');
            this.res[ri].emit('end');
        }
    },

    "sends more requests when max_batch_size < 50": function(test) {
        test.expect(2);
        this.mixpanel.people.batch({changes: this.changes, max_batch_size: 30}, function(error_list) {
            test.equals(
                5, http.request.callCount, // 30 + 30 + 30 + 30 + 10
                "people.batch didn't call send_request correct number of times before callback"
            );
            test.equals(
                null, error_list,
                "people.batch returned errors in callback unexpectedly"
            );
            test.done();
        });
        for (var ri = 0; ri < 5; ri++) {
            this.res[ri].emit('data', '1');
            this.res[ri].emit('end');
        }
    },

    "can set max concurrent requests": function(test) {
        var async_all_stub = Sinon.stub(this.mixpanel, 'async_all');
        async_all_stub.callsArgWith(2, null);

        test.expect(2);
        this.mixpanel.people.batch({changes: this.changes, max_batch_size: 30, max_concurrent_requests: 2}, function(error_list) {
            // should send 5 event batches over 3 request batches:
            // request batch 1: 30 events, 30 events
            // request batch 2: 30 events, 30 events
            // request batch 3: 10 events
            test.equals(
                3, async_all_stub.callCount,
                "people.batch didn't batch concurrent http requests correctly"
            );
            test.equals(
                null, error_list,
                "people.batch returned errors in callback unexpectedly"
            );
            async_all_stub.restore();
            test.done();
        });
        for (var ri = 0; ri < 3; ri++) {
            this.res[ri].emit('data', '1');
            this.res[ri].emit('end');
        }
    },

    "behaves well without a callback": function(test) {
        test.expect(2);
        this.mixpanel.people.batch({changes: this.changes});
        test.equals(
            3, http.request.callCount,
            "people.batch didn't call send_request correct number of times"
        );
        this.mixpanel.people.batch({changes: this.changes, max_batch_size: 100});
        test.equals(
            5, http.request.callCount, // 3 + 100 / 50; last request starts async
            "people.batch didn't call send_request correct number of times"
        );
        test.done();
    }

};