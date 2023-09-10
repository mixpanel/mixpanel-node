const Sinon = require('sinon');
const Mixpanel = require('../lib/mixpanel-node');

exports.logger = {
    'console logger': {
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

        "defaults to console logger": function(test) {
            const loggerName = Object.prototype.toString.call(this.mixpanel.config.logger);
            test.deepEqual(loggerName, '[object console]', "default logger is incorrect");
            test.done();
        },

        "throws an error on incorrect logger object": function(test) {
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

        "writes log for track() method": function(test) {
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

        "writes log for increment() method": function(test) {
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

        "writes log for remove() method": function(test) {
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
    },
    'custom logger': {
        setUp: function(cb) {
            /**
             * Custom logger must be an object with the following methods:
             * 
             * interface CustomLogger {
             *     trace(message?: any, ...optionalParams: any[]): void;
             *     debug(message?: any, ...optionalParams: any[]): void;
             *     info(message?: any, ...optionalParams: any[]): void;
             *     warn(message?: any, ...optionalParams: any[]): void;
             *     error(message?: any, ...optionalParams: any[]): void;
             * }
             */
            this.customLogger = {
                trace: Sinon.stub(),
                debug: Sinon.stub(),
                info: Sinon.stub(),
                warn: Sinon.stub(),
                error: Sinon.stub(),
            };
            this.consoleDebugFn = Sinon.stub(console, 'debug');

            this.mixpanel = Mixpanel.init('test token', {logger: this.customLogger});

            this.mixpanel.send_request = () => {};

            cb();
        },

        tearDown: function(next) {
            this.consoleDebugFn.restore();

            next();
        },

        "writes log for track() method": function(test) {
            this.mixpanel.set_config({debug: true});

            this.mixpanel.track('test', {foo: 'bar'});

            test.ok(
                this.customLogger.debug.calledOnce,
                `debug() method wasn't called on default logger`
            );
            test.ok(
                !this.consoleDebugFn.calledOnce,
                `console.debug() method was called while it shouldn't`
            );

            const [message] = this.customLogger.debug.lastCall.args;

            test.ok(
                message.startsWith('Sending the following event'),
                'incorrect argument was passed to debug() method'
            );

            test.done();
        },

        "writes log for increment() method": function(test) {
            this.mixpanel.set_config({debug: true});

            this.mixpanel.people.increment('bob', 'page_views', 1);

            test.ok(
                this.customLogger.debug.calledOnce,
                `debug() method wasn't called on default logger`
            );
            test.ok(
                !this.consoleDebugFn.calledOnce,
                `console.debug() method was called while it shouldn't`
            );

            const [message] = this.customLogger.debug.lastCall.args;

            test.ok(
                message.startsWith('Sending the following data'),
                'incorrect argument was passed to debug() method'
            );

            test.done();
        },

        "writes log for remove() method": function(test) {
            this.mixpanel.set_config({debug: true});

            this.mixpanel.people.remove('bob', {'browsers': 'firefox'});

            test.ok(
                this.customLogger.debug.calledOnce,
                `debug() method wasn't called on default logger`
            );
            test.ok(
                !this.consoleDebugFn.calledOnce,
                `console.debug() method was called while it shouldn't`
            );

            const [message] = this.customLogger.debug.lastCall.args;

            test.ok(
                message.startsWith('Sending the following data'),
                'incorrect argument was passed to debug() method'
            );

            test.done();
        },
    },
};
