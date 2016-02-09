var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

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
        var modifiers = {'$ignore_time': true, '$ip': '1.2.3.4', '$time': 1234567890};
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
        this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
        "people." + func + " didn't call send_request with correct arguments"
    );
    if (options.use_callback) {
        test.ok(
            this.mixpanel.send_request.args[0][2] === callback,
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
        this.endpoint = "engage";

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
        }
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
            var expected_data = {
                    $append: { $transactions: { $amount: 50 } },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.track_charge(this.distinct_id, 50);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.track_charge didn't call send_request with correct arguments"
            );

            test.done();
        },

        "supports being called with a property object": function(test) {
            var time = new Date('feb 1 2012'),
                prop = { $time: time, isk: 'isk' },
                charge = { $amount: 50, $time: time.toISOString(), isk: 'isk' },
                expected_data = {
                    $append: { $transactions: charge },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.track_charge(this.distinct_id, 50, prop);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.track_charge didn't call send_request with correct arguments"
            );

            test.done();
        },

        "supports being called with a modifiers argument": function(test) {
            this.test_send_request_args(test, 'track_charge', {
                args: [50],
                expected: {$append: {$transactions: {$amount: 50}}},
                use_modifiers: true,
            });
        },

        "supports being called with a property object and a modifiers argument": function(test) {
            var time = new Date('feb 1 2012'),
                prop = { $time: time, isk: 'isk' },
                charge = { $amount: 50, $time: time.toISOString(), isk: 'isk' },
                modifiers = { '$ignore_time': true, '$ip': '1.2.3.4', '$time': 1234567890 },
                expected_data = {
                    $append: { $transactions: charge },
                    $token: this.token,
                    $distinct_id: this.distinct_id,
                    $ignore_time: true,
                    $ip: '1.2.3.4',
                    $time: 1234567890
                };

            this.mixpanel.people.track_charge(this.distinct_id, 50, prop, modifiers);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.track_charge didn't call send_request with correct arguments and/or modifiers"
            );

            test.done();
        },

        "supports being called with a callback": function(test) {
            var expected_data = {
                    $append: { $transactions: { $amount: 50 } },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                },
                callback = function() {};

            this.mixpanel.people.track_charge(this.distinct_id, 50, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.track_charge didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.track_charge didn't call send_request with a callback"
            );

            test.done();
        },

        "supports being called with properties and a callback": function(test) {
            var expected_data = {
                    $append: { $transactions: { $amount: 50 } },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                },
                callback = function() {};

            this.mixpanel.people.track_charge(this.distinct_id, 50, {}, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.track_charge didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.track_charge didn't call send_request with a callback"
            );

            test.done();
        },

        "supports being called with modifiers and a callback": function(test) {
            var modifiers = { '$ignore_time': true, '$ip': '1.2.3.4', '$time': 1234567890 },
                expected_data = {
                    $append: { $transactions: { $amount: 50 } },
                    $token: this.token,
                    $distinct_id: this.distinct_id,
                    $ignore_time: true,
                    $ip: '1.2.3.4',
                    $time: 1234567890
                },
                callback = function() {};

            this.mixpanel.people.track_charge(this.distinct_id, 50, modifiers, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.track_charge didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.track_charge didn't call send_request with a callback"
            );

            test.done();
        },

        "supports being called with properties, modifiers and a callback": function(test) {
            var modifiers = { '$ignore_time': true, '$ip': '1.2.3.4', '$time': 1234567890 },
                time = new Date('feb 1 2012'),
                prop = { $time: time, isk: 'isk' },
                charge = { $amount: 50, $time: time.toISOString(), isk: 'isk' },
                expected_data = {
                    $append: { $transactions: charge },
                    $token: this.token,
                    $distinct_id: this.distinct_id,
                    $ignore_time: true,
                    $ip: '1.2.3.4',
                    $time: 1234567890
                },
                callback = function() {};

            this.mixpanel.people.track_charge(this.distinct_id, 50, prop, modifiers, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.track_charge didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.track_charge didn't call send_request with a callback"
            );

            test.done();
        }
    },

    clear_charges: {
        "calls send_request with correct endpoint and data": function(test) {
            var expected_data = {
                    $set: { $transactions: [] },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.clear_charges(this.distinct_id);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.clear_charges didn't call send_request with correct arguments"
            );

            test.done();
        },

        "supports being called with a modifiers argument": function(test) {
            this.test_send_request_args(test, 'clear_charges', {
                expected: {$set: {$transactions: []}},
                use_modifiers: true,
            });
        },

        "supports being called with a callback": function(test) {
            var expected_data = {
                    $set: { $transactions: [] },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                },
                callback = function() {};

            this.mixpanel.people.clear_charges(this.distinct_id, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.clear_charges didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.clear_charges didn't call send_request with a callback"
            );

            test.done();
        },

        "supports being called with a modifiers argument and a callback": function(test) {
            var modifiers = { '$ignore_time': true, '$ip': '1.2.3.4', '$time': 1234567890 },
                expected_data = {
                    $set: { $transactions: [] },
                    $token: this.token,
                    $distinct_id: this.distinct_id,
                    $ignore_time: true,
                    $ip: '1.2.3.4',
                    $time: 1234567890
                },
                callback = function() {};

            this.mixpanel.people.clear_charges(this.distinct_id, modifiers, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.clear_charges didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.clear_charges didn't call send_request with a callback"
            );

            test.done();
        }
    },

    delete_user: {
        "calls send_request with correct endpoint and data": function(test) {
            var expected_data = {
                $delete: '',
                $token: this.token,
                $distinct_id: this.distinct_id
            };

            this.mixpanel.people.delete_user(this.distinct_id);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.delete_user didn't call send_request with correct arguments"
            );

            test.done();
        },

        "supports being called with a modifiers argument": function(test) {
            this.test_send_request_args(test, 'delete_user', {
                expected: {$delete: ''},
                use_modifiers: true,
            });
        },

        "supports being called with a callback": function(test) {
            var expected_data = {
                    $delete: '',
                    $token: this.token,
                    $distinct_id: this.distinct_id
                },
                callback = function() {};

            this.mixpanel.people.delete_user(this.distinct_id, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.delete_user didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.delete_user didn't call send_request with a callback"
            );

            test.done();
        },

        "supports being called with a modifiers argument and a callback": function(test) {
            var modifiers = { '$ignore_time': true, '$ip': '1.2.3.4', '$time': 1234567890 },
                expected_data = {
                    $delete: '',
                    $token: this.token,
                    $distinct_id: this.distinct_id,
                    $ignore_time: true,
                    $ip: '1.2.3.4',
                    $time: 1234567890
                },
                callback = function() {};

            this.mixpanel.people.delete_user(this.distinct_id, modifiers, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.delete_user didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.delete_user didn't call send_request with a callback"
            );

            test.done();
        }
    },

    union: {
        "calls send_request with correct endpoint and data": function(test) {

            var expected_data = {
                    $union: {'key1': ['value1', 'value2']},
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.union(this.distinct_id, {
                'key1': ['value1', 'value2']
            });

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.union didn't call send_request with correct arguments"
            );

            test.done();

        },

        "supports being called with a scalar value": function(test) {

            var data = {
                    'key1': 'value1'
                },
                expected_data = {
                    $union: {
                        'key1': ['value1']
                    },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.union(this.distinct_id, data);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.union didn't call send_request with correct arguments"
            );

            test.done();
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

            var expected_data = {
                    $union: {'key1': ['value1', 'value2']},
                    $token: this.token,
                    $distinct_id: this.distinct_id
                },
                callback = function () {};

            this.mixpanel.people.union(this.distinct_id, {
                'key1': ['value1', 'value2']
            }, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.union didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.delete_user didn't call send_request with a callback"
            );

            test.done();

        },

        "supports being called with a modifiers argument and a callback": function(test) {
            var modifiers = { '$ignore_time': true, '$ip': '1.2.3.4', '$time': 1234567890 },
                expected_data = {
                    $union: {'key1': ['value1', 'value2']},
                    $token: this.token,
                    $distinct_id: this.distinct_id,
                    $ignore_time: true,
                    $ip: '1.2.3.4',
                    $time: 1234567890
                },
                callback = function () {};

            this.mixpanel.people.union(this.distinct_id, {
                'key1': ['value1', 'value2']
            }, modifiers, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.union didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.delete_user didn't call send_request with a callback"
            );

            test.done();

        }

    },

    unset: {
        "calls send_request with correct endpoint and data": function(test) {

            var expected_data = {
                    $unset: ['key1'],
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.unset(this.distinct_id, 'key1');

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.unset didn't call send_request with correct arguments"
            );

            test.done();
        },
        "supports being called with a property array": function(test) {

            var prop = ['key1', 'key2'],
                expected_data = {
                    $unset: prop,
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.unset(this.distinct_id, prop);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.unset didn't call send_request with correct arguments"
            );

            test.done();
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
            var expected_data = {
                    $unset: ['key1'],
                    $token: this.token,
                    $distinct_id: this.distinct_id
                },
                callback = function () {};

            this.mixpanel.people.unset(this.distinct_id, 'key1', callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.unset didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.unset didn't call send_request with a callback"
            );

            test.done();
        },

        "supports being called with a modifiers argument and a callback": function(test) {

            var modifiers = { '$ignore_time': true, '$ip': '1.2.3.4', '$time': 1234567890 },
                expected_data = {
                    $unset: ['key1'],
                    $token: this.token,
                    $distinct_id: this.distinct_id,
                    $ignore_time: true,
                    $ip: '1.2.3.4',
                    $time: 1234567890
                },
                callback = function () {};

            this.mixpanel.people.unset(this.distinct_id, 'key1', modifiers, callback);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.unset didn't call send_request with correct arguments"
            );

            test.ok(
                this.mixpanel.send_request.args[0][2] === callback,
                "people.unset didn't call send_request with a callback"
            );

            test.done();
        }
    }

};
