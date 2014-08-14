var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

exports.import = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', { key: 'key' });
        this.clock = Sinon.useFakeTimers();

        Sinon.stub(this.mixpanel, 'send_request_v2');

        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_request_v2.restore();
        this.clock.restore();

        next();
    },

    "calls send_request with correct endpoint and data": function(test) {
        var event = "test",
            fromDate = new Date('2014-01-01'),
            toDate = new Date('2014-02-01'),
            props = { event: 'myEvent' },
            expected_endpoint = "/export",
            expected_params = {
                    event: 'myEvent',
                    from_date: '2014-01-01',
                    to_date: '2014-02-01'
            };

        this.mixpanel.export(fromDate, toDate, props);

        test.ok(
            this.mixpanel.send_request_v2.calledWithMatch(expected_endpoint, expected_params),
            "export didn't call send_request with correct arguments"
        );

        test.done();
    }
};

// vim: set et sw=4 tw=4:
