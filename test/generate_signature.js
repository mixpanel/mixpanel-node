var Mixpanel    = require('../lib/mixpanel-node'),
    md5 = require('MD5');

exports.generate_signature = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', {"secret": "API_SECRET"});
        next();
    },

    tearDown: function(next) {
        next();
    },

    "generates the correct signature": function(test) {

        var data = {
            api_key: "API_KEY",
            funnel_id: 1,
            expire: 1370495687157,
            token: "TOKEN"
        };

        var expectedSignature = md5("api_key=API_KEYexpire=1370495687157funnel_id=1token=TOKEN" + this.mixpanel.config.secret);
        var signature = this.mixpanel.generate_signature(data);
        test.equal(signature, expectedSignature, "send_request didn't call http.get with correct arguments");
        test.done();
    }
};
