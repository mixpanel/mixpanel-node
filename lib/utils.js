const querystring = require('querystring');
const Buffer = require('buffer').Buffer;
const http = require('http');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');

/**
 * helper to wait for all callbacks to complete; similar to `Promise.all`
 * exposed to metrics object for unit tests
 * @param {Array} requests
 * @param {Function} handler
 * @param {Function} callback
 */
exports.async_all = function(requests, handler, callback) {
    var total = requests.length,
        errors = null,
        results = [],
        done = function (err, result) {
            if (err) {
                // errors are `null` unless there is an error, which allows for promisification
                errors = errors || [];
                errors.push(err);
            }
            results.push(result);
            if (--total === 0) {
                callback(errors, results)
            }
        };

    if (total === 0) {
        callback(errors, results);
    } else {
        for(var i = 0, l = requests.length; i < l; i++) {
            handler(requests[i], done);
        }
    }
};

/**
 * Validate type of time property, and convert to Unix timestamp if necessary
 * @param {Date|number} time - value to check
 * @returns {number} Unix timestamp
 */
exports.ensure_timestamp = function(time) {
    if (!(time instanceof Date || typeof time === "number")) {
        throw new Error("`time` property must be a Date or Unix timestamp and is only required for `import` endpoint");
    }
    return time instanceof Date ? Math.floor(time.getTime() / 1000) : time;
};

exports.create_config = function(config = {}) {
    const DEFAULTS = {
        test: false,
        debug: false,
        verbose: false,
        host: 'api.mixpanel.com',
        protocol: 'https',
        path: '',
    };
    if (config.host) {
        // Split host into host and port
        const [newHost, port] =  config.host.split(':');
        config = {...config, host: newHost, ...(port ? {port: Number(port)} : null)}
    }

    return {...DEFAULTS, ...config};
};

exports.create_send_request_func = function(config) {
    const REQUEST_LIBS = {
        http: http,
        https: https
    };
    const proxyPath = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const proxyAgent = proxyPath ? new HttpsProxyAgent(proxyPath) : null;

    /**
     * sends an async GET or POST request to mixpanel
     * for batch processes data must be send in the body of a POST
     * @param {object} options
     * @param {string} options.endpoint
     * @param {object} options.data         the data to send in the request
     * @param {string} [options.method]     e.g. `get` or `post`, defaults to `get`
     * @param {function} callback           called on request completion or error
     */
    return function(options, callback) {
        callback = callback || function() {};

        let content = Buffer.from(JSON.stringify(options.data)).toString('base64');
        const endpoint = options.endpoint;
        const method = (options.method || 'GET').toUpperCase();
        let query_params = {
            'ip': 0,
            'verbose': config.verbose ? 1 : 0
        };
        const key = config.key;
        const request_lib = REQUEST_LIBS[config.protocol];
        let request_options = {
            host: config.host,
            port: config.port,
            headers: {},
            method: method
        };
        let request;

        if (!request_lib) {
            throw new Error(
                "Mixpanel Initialization Error: Unsupported protocol " + config.protocol + ". " +
                "Supported protocols are: " + Object.keys(REQUEST_LIBS)
            );
        }


        if (method === 'POST') {
            content = 'data=' + content;
            request_options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            request_options.headers['Content-Length'] = Buffer.byteLength(content);
        } else if (method === 'GET') {
            query_params.data = content;
        }


        // add `key` query params
        if (key) {
            query_params.api_key = key;
        } else if (endpoint === '/import') {
            throw new Error("The Mixpanel Client needs a Mixpanel api key when importing old events: `init(token, { key: ... })`");
        }

        if (proxyAgent) {
            request_options.agent = proxyAgent;
        }

        if (config.test) {
            query_params.test = 1;
        }

        request_options.path = config.path + endpoint + "?" + querystring.stringify(query_params);

        request = request_lib.request(request_options, function(res) {
            var data = "";
            res.on('data', function(chunk) {
                data += chunk;
            });

            res.on('end', function() {
                var e;
                if (config.verbose) {
                    try {
                        var result = JSON.parse(data);
                        if(result.status != 1) {
                            e = new Error("Mixpanel Server Error: " + result.error);
                        }
                    }
                    catch(ex) {
                        e = new Error("Could not parse response from Mixpanel");
                    }
                }
                else {
                    e = (data !== '1') ? new Error("Mixpanel Server Error: " + data) : undefined;
                }

                callback(e);
            });
        });

        request.on('error', function(e) {
            if (config.debug) {
                console.log("Got Error: " + e.message);
            }
            callback(e);
        });

        if (method === 'POST') {
            request.write(content);
        }
        request.end();
    };
};

