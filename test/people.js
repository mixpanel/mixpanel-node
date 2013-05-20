var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

exports.people = {
    setUp: function(next) {
        this.token = 'token';
        this.mixpanel = Mixpanel.init(this.token);

        Sinon.stub(this.mixpanel, 'send_request');

        this.distinct_id = "user1";
        this.endpoint = "engage";

        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_request.restore();

        next();
    },

    set: {
        "handles set_once correctly": function(test){
            var expected_data = {
                $set_once: {key1: 'val1'},
                $token: this.token,
                $distinct_id: this.distinct_id
            };

            this.mixpanel.people.set_once(this.distinct_id, 'key1', 'val1');

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.set given the set_once flag, didn't call send request with correct arguments"
            );

            test.done();
        },

        "calls send_request with correct endpoint and data": function(test) {
            var expected_data = {
                    $set: { key1: 'val1' },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.set(this.distinct_id, 'key1', 'val1');

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.set didn't call send_request with correct arguments"
            );

            test.done();
        },

        "supports being called with a property object": function(test) {
            var prop = { key1: 'val1', key2: 'val2' },
                expected_data = {
                    $set: prop,
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.set(this.distinct_id, prop);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.set didn't call send_request with correct arguments"
            );

            test.done();
        },

        "handles the ip property in a property object properly": function(test) {
            var prop = { ip: '1.2.3.4', key1: 'val1', key2: 'val2' },
                expected_data = {
                    $set: { key1: 'val1', key2: 'val2' },
                    $token: this.token,
                    $distinct_id: this.distinct_id,
                    $ip: '1.2.3.4'
                };

            this.mixpanel.people.set(this.distinct_id, prop);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.set didn't call send_request with correct arguments"
            );

            test.done();
        }
    },

    increment: {
        "calls send_request with correct endpoint and data": function(test) {
            var expected_data = {
                    $add: { key1: 1 },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.increment(this.distinct_id, 'key1');

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.increment didn't call send_request with correct arguments"
            );

            test.done();
        },

        "supports incrementing key by value": function(test) {
            var expected_data = {
                    $add: { key1: 2 },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.increment(this.distinct_id, "key1", 2);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.increment didn't call send_request with correct arguments"
            );

            test.done();
        },

        "supports incrementing multiple keys": function(test) {
            var prop = { key1: 5, key2: -3 },
                expected_data = {
                    $add: prop,
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.increment(this.distinct_id, prop);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.increment didn't call send_request with correct arguments"
            );

            test.done();
        },

        "ignores invalid values": function(test) {
            var prop = { key1: "bad", key2: 3, key3: undefined, key4: "5", key5: new Date(), key6: function(){} },
                expected_data = {
                    $add: { key2: 3, key4: '5' },
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.increment(this.distinct_id, prop);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.increment didn't call send_request with correct arguments"
            );

            test.done();
        }
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
        }
    },

    delete_user: {
        "calls send_request with correct endpoint and data": function(test) {
            var expected_data = {
                    $delete: this.distinct_id,
                    $token: this.token,
                    $distinct_id: this.distinct_id
                };

            this.mixpanel.people.delete_user(this.distinct_id);

            test.ok(
                this.mixpanel.send_request.calledWithMatch(this.endpoint, expected_data),
                "people.delete_user didn't call send_request with correct arguments"
            );

            test.done();
        }
    },

};
