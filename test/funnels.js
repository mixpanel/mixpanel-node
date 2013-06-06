var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

exports.funnels = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', { key: 'key', secret: 'secret'});
        this.clock = Sinon.useFakeTimers();

        Sinon.stub(this.mixpanel, 'send_export_request');

        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_export_request.restore();
        this.clock.restore();

        next();
    },
    "requires the funnel_id argument": function(test) {

        test.throws(
            function() {
                this.mixpanel.data_export.funnels.get("funnel id", {});
                this.mixpanel.data_export.funnels.get(null, {});
            },
            "The funnels method requires you to specify the funnel_id ",
            "funnels didn't throw an error when funnel_id wasn't specified"
        );

        test.done();
    },
    "calls send_export_request with correct endpoint and data while listing funnels": function(test) {
        var expected_endpoint = "/funnels/list";

        this.mixpanel.data_export.funnels.list();

        test.ok(
            this.mixpanel.send_export_request.calledWithMatch(expected_endpoint, {}),
            "funnels didn't call send_export_request with correct arguments"
        );

        test.done();
    },
    "calls send_export_request with correct endpoint and data while fetching a funnel": function(test) {
        var funnel_id = "test",
            expected_endpoint = "/funnels",
            expected_data = {
                funnel_id:funnel_id
            };

        this.mixpanel.data_export.funnels.get(funnel_id);

        test.ok(
            this.mixpanel.send_export_request.calledWithMatch(expected_endpoint, expected_data),
            "funnels didn't call send_export_request with correct arguments"
        );

        test.done();
    }
};
