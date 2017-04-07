/*
    Heavily inspired by the original js library copyright Mixpanel, Inc.
    (http://mixpanel.com/)

    Copyright (c) 2012 Carl Sverre

    Released under the MIT license.
*/

var http            = require('http'),
    https           = require('https'),
    querystring     = require('querystring'),
    Buffer          = require('buffer').Buffer,
    util            = require('util'),
    HttpsProxyAgent = require('https-proxy-agent');

var REQUEST_LIBS = {
    http: http,
    https: https
};

var create_proxy_agent = function() {
    var proxyPath = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

    if (proxyPath) {
        return new HttpsProxyAgent(proxyPath);
    }

    return;
}

var create_client = function(token, config) {
    var metrics = {};
    var proxyAgent = create_proxy_agent();

    // mixpanel constants
    var MAX_BATCH_SIZE = 50,
        TRACK_AGE_LIMIT = 60 * 60 * 24 * 5;

    if(!token) {
        throw new Error("The Mixpanel Client needs a Mixpanel token: `init(token)`");
    }

    // Default config
    metrics.config = {
        test: false,
        debug: false,
        verbose: false,
        host: 'api.mixpanel.com',
        protocol: 'http'
    };

    metrics.token = token;

    /**
     * sends an async GET or POST request to mixpanel
     * for batch processes data must be send in the body of a POST
     * @param {object} options
     * @param {string} options.endpoint
     * @param {object} options.data         the data to send in the request
     * @param {string} [options.method]     e.g. `get` or `post`, defaults to `get`
     * @param {function} callback           called on request completion or error
     */
    metrics.send_request = function(options, callback) {
        callback = callback || function() {};

        var content = (new Buffer(JSON.stringify(options.data))).toString('base64'),
            endpoint = options.endpoint,
            method = (options.method || 'GET').toUpperCase(),
            query_params = {
                'ip': 0,
                'verbose': metrics.config.verbose ? 1 : 0
            },
            key = metrics.config.key,
            request_lib = REQUEST_LIBS[metrics.config.protocol],
            request_options = {
                host: metrics.config.host,
                port: metrics.config.port,
                headers: {},
                method: method
            },
            request;

        if (!request_lib) {
            throw new Error(
                "Mixpanel Initialization Error: Unsupported protocol " + metrics.config.protocol + ". " +
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

        if (metrics.config.test) {
            query_params.test = 1;
        }

        request_options.path = endpoint + "?" + querystring.stringify(query_params);

        request = request_lib.request(request_options, function(res) {
            var data = "";
            res.on('data', function(chunk) {
                data += chunk;
            });

            res.on('end', function() {
                var e;
                if (metrics.config.verbose) {
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
            if (metrics.config.debug) {
                console.log("Got Error: " + e.message);
            }
            callback(e);
        });

        if (method === 'POST') {
            request.write(content);
        }
        request.end();
    };

    /**
     * Send an event to Mixpanel, using the specified endpoint (e.g., track/import)
     * @param {string} endpoint - API endpoint name
     * @param {string} event - event name
     * @param {object} properties - event properties
     * @param {Function} [callback] - callback for request completion/error
     */
    metrics.send_event_request = function(endpoint, event, properties, callback) {
        properties.token = metrics.token;
        properties.mp_lib = "node";

        var data = {
            event: event,
            properties: properties
        };

        if (metrics.config.debug) {
            console.log("Sending the following event to Mixpanel:\n", data);
        }

        metrics.send_request({ method: "GET", endpoint: endpoint, data: data }, callback);
    };

    /**
     * Validate type of time property, and convert to Unix timestamp if necessary
     * @param {Date|number} time - value to check
     * @returns {number} Unix timestamp
     */
    var ensure_timestamp = function(time) {
        if (!(time instanceof Date || typeof time === "number")) {
            throw new Error("`time` property must be a Date or Unix timestamp and is only required for `import` endpoint");
        }
        return time instanceof Date ? Math.floor(time.getTime() / 1000) : time;
    };

    /**
     * breaks array into equal-sized chunks, with the last chunk being the remainder
     * @param {Array} arr
     * @param {number} size
     * @returns {Array}
     */
    var chunk = function(arr, size) {
        var chunks = [],
            i = 0,
            total = arr.length;

        while (i < total) {
            chunks.push(arr.slice(i, i += size));
        }
        return chunks;
    };

    /**
     * helper to wait for all callbacks to complete; similar to `Promise.all`
     * exposed to metrics object for unit tests
     * @param {Array} requests
     * @param {Function} handler
     * @param {Function} callback
     */
    metrics.async_all = function(requests, handler, callback) {
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
     * sends events in batches
     * @param {object}   options
     * @param {[{}]}     options.event_list                 array of event objects
     * @param {string}   options.endpoint                   e.g. `/track` or `/import`
     * @param {number}   [options.max_concurrent_requests]  limits concurrent async requests over the network
     * @param {number}   [options.max_batch_size]           limits number of events sent to mixpanel per request
     * @param {Function} [callback]                         callback receives array of errors if any
     *
     */
    var send_batch_requests = function(options, callback) {
        var event_list = options.event_list,
            endpoint = options.endpoint,
            max_batch_size = options.max_batch_size ? Math.min(MAX_BATCH_SIZE, options.max_batch_size) : MAX_BATCH_SIZE,
            // to maintain original intention of max_batch_size; if max_batch_size is greater than 50, we assume the user is trying to set max_concurrent_requests
            max_concurrent_requests = options.max_concurrent_requests || (options.max_batch_size > MAX_BATCH_SIZE && Math.ceil(options.max_batch_size / MAX_BATCH_SIZE)),
            event_batches = chunk(event_list, max_batch_size),
            request_batches = max_concurrent_requests ? chunk(event_batches, max_concurrent_requests) : [event_batches],
            total_event_batches = event_batches.length,
            total_request_batches = request_batches.length;

        /**
         * sends a batch of events to mixpanel through http api
         * @param {Array} batch
         * @param {Function} cb
         */
        function send_event_batch(batch, cb) {
            if (batch.length > 0) {
                batch = batch.map(function (event) {
                    var properties = event.properties;

                    if (endpoint === '/import' || event.properties.time) {
                        // usually there will be a time property, but not required for `/track` endpoint
                        event.properties.time = ensure_timestamp(event.properties.time);
                    }
                    event.properties.token = event.properties.token || metrics.token;
                    return event;
                });

                // must be a POST
                metrics.send_request({ method: "POST", endpoint: endpoint, data: batch }, cb);
            }
        }

        /**
         * Asynchronously sends batches of requests
         * @param {number} index
         */
        function send_next_request_batch(index) {
            var request_batch = request_batches[index],
                cb = function (errors, results) {
                    index += 1;
                    if (index === total_request_batches) {
                        callback && callback(errors, results);
                    } else {
                        send_next_request_batch(index);
                    }
                };

            metrics.async_all(request_batch, send_event_batch, cb);
        }

        // init recursive function
        send_next_request_batch(0);

        if (metrics.config.debug) {
            console.log(
                "Sending " + event_list.length + " events to Mixpanel in " +
                total_event_batches + " batches of events and " +
                total_request_batches + " batches of requests"
            );
        }
    };

    /**
         track(event, properties, callback)
         ---
         this function sends an event to mixpanel.

         event:string                    the event name
         properties:object               additional event properties to send
         callback:function(err:Error)    callback is called when the request is
                                         finished or an error occurs
     */
    metrics.track = function(event, properties, callback) {
        if (!properties || typeof properties === "function") {
            callback = properties;
            properties = {};
        }

        // time is optional for `track` but must be less than 5 days old if set
        if (properties.time) {
            properties.time = ensure_timestamp(properties.time);
            if (properties.time < Date.now() / 1000 - TRACK_AGE_LIMIT) {
                throw new Error("`track` not allowed for event more than 5 days old; use `mixpanel.import()`");
            }
        }

        metrics.send_event_request("/track", event, properties, callback);
    };

    /**
     * send a batch of events to mixpanel `track` endpoint: this should only be used if events are less than 5 days old
     * @param {object}   options
     * @param {Array}    options.event_list                 array of event objects to track
     * @param {object}   [options.max_concurrent_requests]  number of concurrent http requests that can be made to mixpanel
     * @param {object}   [options.max_batch_size]           number of events that can be sent to mixpanel per request
     * @param {Function} [callback]                         callback receives array of errors if any
     */
    metrics.track_batch = function(options, callback) {
        var batch_options = {
            event_list: options.event_list,
            endpoint: "/track",
            max_concurrent_requests: options.max_concurrent_requests,
            max_batch_size: options.max_batch_size
        };

        send_batch_requests(batch_options, callback);
    };

    /**
        import(event, time, properties, callback)
        ---
        This function sends an event to mixpanel using the import
        endpoint.  The time argument should be either a Date or Number,
        and should signify the time the event occurred.

        It is highly recommended that you specify the distinct_id
        property for each event you import, otherwise the events will be
        tied to the IP address of the sending machine.

        For more information look at:
        https://mixpanel.com/docs/api-documentation/importing-events-older-than-31-days

        event:string                    the event name
        time:date|number                the time of the event
        properties:object               additional event properties to send
        callback:function(err:Error)    callback is called when the request is
                                        finished or an error occurs
    */
    metrics.import = function(event, time, properties, callback) {
        if (!properties || typeof properties === "function") {
            callback = properties;
            properties = {};
        }

        properties.time = ensure_timestamp(time);

        metrics.send_event_request("/import", event, properties, callback);
    };

    /**
        import_batch(event_list, options, callback)
        ---
        This function sends a list of events to mixpanel using the import
        endpoint. The format of the event array should be:

        [
            {
                "event": "event name",
                "properties": {
                    "time": new Date(), // Number or Date; required for each event
                    "key": "val",
                    ...
                }
            },
            {
                "event": "event name",
                "properties": {
                    "time": new Date()  // Number or Date; required for each event
                }
            },
            ...
        ]

        See import() for further information about the import endpoint.

        Options:
            max_batch_size: the maximum number of events to be transmitted over
                            the network simultaneously. useful for capping bandwidth
                            usage.
            max_concurrent_requests: the maximum number of concurrent http requests that
                            can be made to mixpanel; also useful for capping bandwidth.

        N.B.: the Mixpanel API only accepts 50 events per request, so regardless
        of max_batch_size, larger lists of events will be chunked further into
        groups of 50.

        event_list:array                    list of event names and properties
        options:object                      optional batch configuration
        callback:function(error_list:array) callback is called when the request is
                                            finished or an error occurs
    */
    metrics.import_batch = function(event_list, options, callback) {
        var batch_options;

        if (typeof(options) === "function" || !options) {
            callback = options;
            options = {};
        }
        batch_options = {
            event_list: event_list,
            endpoint: "/import",
            max_concurrent_requests: options.max_concurrent_requests,
            max_batch_size: options.max_batch_size
        };
        send_batch_requests(batch_options, callback);
    };

    /**
        alias(distinct_id, alias)
        ---
        This function creates an alias for distinct_id

        For more information look at:
        https://mixpanel.com/docs/integration-libraries/using-mixpanel-alias

        distinct_id:string              the current identifier
        alias:string                    the future alias
    */
    metrics.alias = function(distinct_id, alias, callback) {
        var properties = {
            distinct_id: distinct_id,
            alias: alias
        };

        metrics.track('$create_alias', properties, callback);
    };

    metrics.people = {
        /** people.set_once(distinct_id, prop, to, modifiers, callback)
            ---
            The same as people.set but in the words of mixpanel:
            mixpanel.people.set_once

            " This method allows you to set a user attribute, only if
             it is not currently set. It can be called multiple times
             safely, so is perfect for storing things like the first date
             you saw a user, or the referrer that brought them to your
             website for the first time. "

        */
        set_once: function(distinct_id, prop, to, modifiers, callback) {
            var $set = {};

            if (typeof(prop) === 'object') {
                if (typeof(to) === 'object') {
                    callback = modifiers;
                    modifiers = to;
                } else {
                    callback = to;
                }
                $set = prop;
            } else {
                $set[prop] = to;
                if (typeof(modifiers) === 'function' || !modifiers) {
                    callback = modifiers;
                }
            }

            modifiers = modifiers || {};
            modifiers.set_once = true;

            this._set(distinct_id, $set, callback, modifiers);
        },

        /**
            people.set(distinct_id, prop, to, modifiers, callback)
            ---
            set properties on an user record in engage

            usage:

                mixpanel.people.set('bob', 'gender', 'm');

                mixpanel.people.set('joe', {
                    'company': 'acme',
                    'plan': 'premium'
                });
        */
        set: function(distinct_id, prop, to, modifiers, callback) {
            var $set = {};

            if (typeof(prop) === 'object') {
                if (typeof(to) === 'object') {
                    callback = modifiers;
                    modifiers = to;
                } else {
                    callback = to;
                }
                $set = prop;
            } else {
                $set[prop] = to;
                if (typeof(modifiers) === 'function' || !modifiers) {
                    callback = modifiers;
                }
            }

            this._set(distinct_id, $set, callback, modifiers);
        },

        // used internally by set and set_once
        _set: function(distinct_id, $set, callback, options) {
            options = options || {};
            var set_key = (options && options.set_once) ? "$set_once" : "$set";

            var data = {
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };
            data[set_key] = $set;

            if ('ip' in $set) {
                data.$ip = $set.ip;
                delete $set.ip;
            }

            if ($set.$ignore_time) {
                data.$ignore_time = $set.$ignore_time;
                delete $set.$ignore_time;
            }

            data = merge_modifiers(data, options);

            if (metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request({ method: "GET", endpoint: "/engage", data: data }, callback);
        },

        /**
            people.increment(distinct_id, prop, by, modifiers, callback)
            ---
            increment/decrement properties on an user record in engage

            usage:

                mixpanel.people.increment('bob', 'page_views', 1);

                // or, for convenience, if you're just incrementing a counter by 1, you can
                // simply do
                mixpanel.people.increment('bob', 'page_views');

                // to decrement a counter, pass a negative number
                mixpanel.people.increment('bob', 'credits_left', -1);

                // like mixpanel.people.set(), you can increment multiple properties at once:
                mixpanel.people.increment('bob', {
                    counter1: 1,
                    counter2: 3,
                    counter3: -2
                });
        */
        increment: function(distinct_id, prop, by, modifiers, callback) {
            var $add = {};

            if (typeof(prop) === 'object') {
                if (typeof(by) === 'object') {
                    callback = modifiers;
                    modifiers = by;
                } else {
                    callback = by;
                }
                Object.keys(prop).forEach(function(key) {
                    var val = prop[key];

                    if (isNaN(parseFloat(val))) {
                        if (metrics.config.debug) {
                            console.error("Invalid increment value passed to mixpanel.people.increment - must be a number");
                            console.error("Passed " + key + ":" + val);
                        }
                        return;
                    } else {
                        $add[key] = val;
                    }
                });
            } else {
                if (typeof(by) === 'number' || !by) {
                    by = by || 1;
                    $add[prop] = by;
                    if (typeof(modifiers) === 'function') {
                        callback = modifiers;
                    }
                } else if (typeof(by) === 'function') {
                    callback = by;
                    $add[prop] = 1;
                } else {
                    callback = modifiers;
                    modifiers = (typeof(by) === 'object') ? by : {};
                    $add[prop] = 1;
                }
            }

            var data = {
                '$add': $add,
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            data = merge_modifiers(data, modifiers);

            if (metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request({ method: "GET", endpoint: "/engage", data: data }, callback);
        },

        /**
            people.append(distinct_id, prop, value, modifiers, callback)
            ---
            Append a value to a list-valued people analytics property.

            usage:

                // append a value to a list, creating it if needed
                mixpanel.people.append('pages_visited', 'homepage');

                // like mixpanel.people.set(), you can append multiple properties at once:
                mixpanel.people.append({
                    list1: 'bob',
                    list2: 123
                });
        */
        append: function(distinct_id, prop, value, modifiers, callback) {
            var $append = {};

            if (typeof(prop) === 'object') {
                if (typeof(value) === 'object') {
                    callback = modifiers;
                    modifiers = value;
                } else {
                    callback = value;
                }
                Object.keys(prop).forEach(function(key) {
                    $append[key] = prop[key];
                });
            } else {
                $append[prop] = value;
                if (typeof(modifiers) === 'function') {
                    callback = modifiers;
                }
            }

            var data = {
                '$append': $append,
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            data = merge_modifiers(data, modifiers);

            if (metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request({ method: "GET", endpoint: "/engage", data: data }, callback);
        },

        /**
            people.track_charge(distinct_id, amount, properties, modifiers, callback)
            ---
            Record that you have charged the current user a certain
            amount of money.

            usage:

                // charge a user $29.99
                mixpanel.people.track_charge('bob', 29.99);

                // charge a user $19 on the 1st of february
                mixpanel.people.track_charge('bob', 19, { '$time': new Date('feb 1 2012') });
        */
        track_charge: function(distinct_id, amount, properties, modifiers, callback) {
            if (typeof(properties) === 'function' || !properties) {
                callback = properties || function() {};
                properties = {};
            } else {
                if (typeof(modifiers) === 'function' || !modifiers) {
                    callback = modifiers || function() {};
                    if (properties.$ignore_time || properties.hasOwnProperty("$ip")) {
                        modifiers = {};
                        Object.keys(properties).forEach(function(key) {
                            modifiers[key] = properties[key];
                            delete properties[key];
                        });
                    }
                }
            }

            if (typeof(amount) !== 'number') {
                amount = parseFloat(amount);
                if (isNaN(amount)) {
                    console.error("Invalid value passed to mixpanel.people.track_charge - must be a number");
                    return;
                }
            }

            properties.$amount = amount;

            if (properties.hasOwnProperty('$time')) {
                var time = properties.$time;
                if (Object.prototype.toString.call(time) === '[object Date]') {
                    properties.$time = time.toISOString();
                }
            }

            var data = {
                '$append': { '$transactions': properties },
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            data = merge_modifiers(data, modifiers);

            if (metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request({ method: "GET", endpoint: "/engage", data: data }, callback);
        },

        /**
            people.clear_charges(distinct_id, modifiers, callback)
            ---
            Clear all the current user's transactions.

            usage:

                mixpanel.people.clear_charges('bob');
        */
        clear_charges: function(distinct_id, modifiers, callback) {
            var data = {
                '$set': { '$transactions': [] },
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            if (typeof(modifiers) === 'function') { callback = modifiers; }

            data = merge_modifiers(data, modifiers);

            if (metrics.config.debug) {
                console.log("Clearing this user's charges:", distinct_id);
            }

            metrics.send_request({ method: "GET", endpoint: "/engage", data: data }, callback);
        },

        /**
            people.delete_user(distinct_id, modifiers, callback)
            ---
            delete an user record in engage

            usage:

                mixpanel.people.delete_user('bob');
        */
        delete_user: function(distinct_id, modifiers, callback) {
            var data = {
                '$delete': '',
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            if (typeof(modifiers) === 'function') { callback = modifiers; }

            data = merge_modifiers(data, modifiers);

            if (metrics.config.debug) {
                console.log("Deleting the user from engage:", distinct_id);
            }

            metrics.send_request({ method: "GET", endpoint: "/engage", data: data }, callback);
        },

        /**
         people.union(distinct_id, data, modifiers, callback)
         ---
         merge value(s) into a list-valued people analytics property.

         usage:

            mixpanel.people.union('bob', {'browsers': 'firefox'});

            mixpanel.people.union('bob', {'browsers', ['chrome'], os: ['linux']});
         */
        union: function(distinct_id, data, modifiers, callback) {
            var $union = {};

            if (typeof(data) !== 'object' || util.isArray(data)) {
                if (metrics.config.debug) {
                    console.error("Invalid value passed to mixpanel.people.union - data must be an object with array values");
                }
                return;
            }

            Object.keys(data).forEach(function(key) {
                var val = data[key];
                if (util.isArray(val)) {
                    var merge_values = val.filter(function(v) {
                        return typeof(v) === 'string' || typeof(v) === 'number';
                    });
                    if (merge_values.length > 0) {
                        $union[key] = merge_values;
                    }
                } else if (typeof(val) === 'string' || typeof(val) === 'number') {
                    $union[key] = [val];
                } else {
                    if (metrics.config.debug) {
                        console.error("Invalid argument passed to mixpanel.people.union - values must be a scalar value or array");
                        console.error("Passed " + key + ':', val);
                    }
                    return;
                }
            });

            if (Object.keys($union).length === 0) {
                return;
            }

            data = {
                '$union': $union,
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            if (typeof(modifiers) === 'function') {
                callback = modifiers;
            }

            data = merge_modifiers(data, modifiers);

            if (metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request({ method: "GET", endpoint: "/engage", data: data }, callback);
        },

        /**
         people.unset(distinct_id, prop, modifiers, callback)
         ---
         delete a property on an user record in engage

         usage:

            mixpanel.people.unset('bob', 'page_views');

            mixpanel.people.unset('bob', ['page_views', 'last_login']);
         */
        unset: function(distinct_id, prop, modifiers, callback) {
            var $unset = [];

            if (util.isArray(prop)) {
                $unset = prop;
            } else if (typeof(prop) === 'string') {
                $unset = [prop];
            } else {
                if (metrics.config.debug) {
                    console.error("Invalid argument passed to mixpanel.people.unset - must be a string or array");
                    console.error("Passed: " + prop);
                }
                return;
            }

            var data = {
                '$unset': $unset,
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            if (typeof(modifiers) === 'function') {
                callback = modifiers;
            }

            data = merge_modifiers(data, modifiers);

            if (metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request({ method: "GET", endpoint: "/engage", data: data }, callback);
        }
    };

    var merge_modifiers = function(data, modifiers) {
        if (modifiers) {
            if (modifiers.$ignore_alias) {
                data.$ignore_alias = modifiers.$ignore_alias;
            }
            if (modifiers.$ignore_time) {
                data.$ignore_time = modifiers.$ignore_time;
            }
            if (modifiers.hasOwnProperty("$ip")) {
                data.$ip = modifiers.$ip;
            }
            if (modifiers.hasOwnProperty("$time")) {
                data.$time = ensure_timestamp(modifiers.$time);
            }
        }
        return data;
    };

    /**
        set_config(config)
        ---
        Modifies the mixpanel config

        config:object       an object with properties to override in the
                            mixpanel client config
    */
    metrics.set_config = function(config) {
        for (var c in config) {
            if (config.hasOwnProperty(c)) {
                if (c == "host") { // Split host, into host and port.
                    metrics.config.host = config[c].split(':')[0];
                    var port = config[c].split(':')[1];
                    if (port) {
                        metrics.config.port = Number(port);
                    }
                } else {
                    metrics.config[c] = config[c];
                }
            }
        }
    };

    if (config) {
        metrics.set_config(config);
    }

    return metrics;
};

// module exporting
module.exports = {
    Client: function(token) {
        console.warn("The function `Client(token)` is deprecated.  It is now called `init(token)`.");
        return create_client(token);
    },
    init: create_client
};
