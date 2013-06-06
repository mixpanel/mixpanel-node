var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

exports.import = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', { key: 'key' });
        this.clock = Sinon.useFakeTimers();

        Sinon.stub(this.mixpanel, 'send_request');

        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_request.restore();
        this.clock.restore();

        next();
    },

    "calls send_request with correct endpoint and data": function(test) {
        var funnel_id = "test",
            expected_endpoint = "/funnels",
            expected_data = {
                funnel_id:funnel_id
            };

        this.mixpanel.funnels(expected_data);

        test.ok(
            this.mixpanel.send_request.calledWithMatch(expected_endpoint, expected_data),
            "funnels didn't call send_request with correct arguments"
        );

        test.done();
    },

    "requires the funnel_id argument": function(test) {
        test.throws(
            function() { this.mixpanel.funnels("funnel_id"); },
            "The funnels method requires you to specify the funnel_id ",
            "funnels didn't throw an error when funnel_id wasn't specified"
        );

        test.done();
    }
};
