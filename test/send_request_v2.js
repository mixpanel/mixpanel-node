var Mixpanel    = require('../lib/mixpanel-node'),
    Sinon       = require('sinon'),
    http        = require('http'),
    events      = require('events');

exports.send_request_v2 = {
    setUp: function(next) {
        this.mixpanel = Mixpanel.init('token', {key: 'pretty', secret: 'really'});

        Sinon.stub(http, 'get');
        Sinon.useFakeTimers();

        this.http_emitter = new events.EventEmitter();
        this.res = new events.EventEmitter();

        http.get.returns(this.http_emitter);
        http.get.callsArgWith(1, this.res);

        next();
    },

    tearDown: function(next) {
        http.get.restore();

        next();
    },

    "sends correct data": function(test) {
        var endpoint = "/export",
            data = {
                from_date: new Date('2014-01-01'),
                to_date: new Date('2015-01-01')
            };

        var expected_http_get = {
            host: 'data.mixpanel.com',
            headers: {},
            path: '/api/2.0/export?from_date=&to_date=&api_key=pretty&expire=60&sig=e091dda5473cf796dc35f77efe603330'
        };

        this.mixpanel.send_request_v2(endpoint, data);

        test.ok(http.get.calledWithMatch(expected_http_get), "send_request_v2 didn't call http.get with correct arguments");

        test.done();
    }
};

// vim: set et sw=4 ts=4:
