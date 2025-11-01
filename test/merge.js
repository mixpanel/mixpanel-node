var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon');

exports.merge = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', { key: 'key' });

        Sinon.stub(this.mixpanel, 'send_request');

        next();
    },

    tearDown: function(next) {
        this.mixpanel.send_request.restore();

        next();
    },

    "calls send_request with correct endpoint and data": function(test) {
        var distinct_id_1 = "distinct_id1",
            distinct_id_2 = "distinct_id2",
            expected_endpoint = "/import",
            expected_data = {
                event: '$merge',
                properties: {
                    distinct_ids: [distinct_id_1, distinct_id_2],
                    token: 'token'
                }
            };

        this.mixpanel.merge(distinct_id_1, distinct_id_2);
        test.ok(
            this.mixpanel.send_request.calledWithMatch({ endpoint: expected_endpoint, data: expected_data }),
            "merge didn't call send_request with correct arguments"
        );

        test.done();
    }
};
