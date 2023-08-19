const Sinon = require('sinon');
const Mixpanel = require('../lib/mixpanel-node');

exports.logger = {
    setUp: function(cb) {
        this.consoleDebugFn = Sinon.stub(console, 'debug');

        this.mixpanel = Mixpanel.init('test token');

        this.mixpanel.send_request = () => {};

        cb();
    },

    tearDown: function(next) {
        this.consoleDebugFn.restore();

        next();
    },

    "is default logger is console object": function(test) {
        const loggerName = Object.prototype.toString.call(this.mixpanel.config.logger);
        test.deepEqual(loggerName, '[object console]', "default logger is incorrect");
        test.done();
    },

    "is throws an error on incorrect logger object": function(test) {
        test.throws(
            () => this.mixpanel.set_config({logger: false}),
            TypeError,
            "logger object must be a valid Logger object"
        );
        test.throws(
            () => this.mixpanel.set_config({logger: {log: () => {}}}),
            TypeError,
            "logger object must be a valid Logger object"
        );
        test.done();
    },

    "is write log for track() method": function(test) {
        this.mixpanel.set_config({debug: true});

        this.mixpanel.track('test', {foo: 'bar'});

        test.ok(
            this.consoleDebugFn.calledOnce,
            `debug() method wasn't called on default logger`
        );

        const [message] = this.consoleDebugFn.lastCall.args;

        test.ok(
            message.startsWith('Sending the following event'),
            'incorrect argument was passed to debug() method'
        );

        test.done();
    },

    "is write log for increment() method": function(test) {
        this.mixpanel.set_config({debug: true});

        this.mixpanel.people.increment('bob', 'page_views', 1);

        test.ok(
            this.consoleDebugFn.calledOnce,
            `debug() method wasn't called on default logger`
        );

        const [message] = this.consoleDebugFn.lastCall.args;

        test.ok(
            message.startsWith('Sending the following data'),
            'incorrect argument was passed to debug() method'
        );

        test.done();
    },

    "is write log for remove() method": function(test) {
        this.mixpanel.set_config({debug: true});

        this.mixpanel.people.remove('bob', {'browsers': 'firefox'});

        test.ok(
            this.consoleDebugFn.calledOnce,
            `debug() method wasn't called on default logger`
        );

        const [message] = this.consoleDebugFn.lastCall.args;

        test.ok(
            message.startsWith('Sending the following data'),
            'incorrect argument was passed to debug() method'
        );

        test.done();
    },
};
