/*
    Heavily inspired by the original js library copyright Mixpanel, Inc.
    (http://mixpanel.com/)

    Copyright (c) 2012 Carl Sverre

    Released under the MIT license.
*/

var http            = require('http'),
    querystring     = require('querystring'),
    Buffer          = require('buffer').Buffer,
    util            = require('util');

var create_client = function(token, config) {
    var metrics = {};

    if(!token) {
        throw new Error("The Mixpanel Client needs a Mixpanel token: `init(token)`");
    }

    // Default config
    metrics.config = {
        test: false,
        debug: false,
        verbose: false,
        host: 'api.mixpanel.com'
    };

    metrics.token = token;

    /**
        send_request(data)
        ---
        this function sends an async GET request to mixpanel

        data:object                     the data to send in the request
        callback:function(err:Error)    callback is called when the request is
                                        finished or an error occurs
    */
    metrics.send_request = function(endpoint, data, callback) {
        callback = callback || function() {};
        var event_data = new Buffer(JSON.stringify(data));
        var request_data = {
            'data': event_data.toString('base64'),
            'ip': 0,
            'verbose': metrics.config.verbose ? 1 : 0
        };

        if (endpoint === '/import') {
            var key = metrics.config.key;
            if (!key) {
                throw new Error("The Mixpanel Client needs a Mixpanel api key when importing old events: `init(token, { key: ... })`");
            }
            request_data.api_key = key;
        }

        var request_options = {
            host: metrics.config.host,
            port: metrics.config.port,
            headers: {}
        };

        if (metrics.config.test) { request_data.test = 1; }

        var query = querystring.stringify(request_data);

        request_options.path = [endpoint,"?",query].join("");

        http.get(request_options, function(res) {
            var data = "";
            res.on('data', function(chunk) {
               data += chunk;
            });

            res.on('end', function() {
                var e;
                if(metrics.config.verbose) {
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
        }).on('error', function(e) {
            if(metrics.config.debug) {
                console.log("Got Error: " + e.message);
            }
            callback(e);
        });
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
        if (typeof(properties) === 'function' || !properties) {
            callback = properties;
            properties = {};
        }

        // if properties.time exists, use import endpoint
        var endpoint = (typeof(properties.time) === 'number') ? '/import' : '/track';

        properties.token = metrics.token;
        properties.mp_lib = "node";

        var data = {
            'event' : event,
            'properties' : properties
        };

        if (metrics.config.debug) {
            console.log("Sending the following event to Mixpanel:");
            console.log(data);
        }

        metrics.send_request(endpoint, data, callback);
    };

    var parse_time = function(time) {
        if (time === void 0) {
            throw new Error("Import methods require you to specify the time of the event");
        } else if (Object.prototype.toString.call(time) === '[object Date]') {
            time = Math.floor(time.getTime() / 1000);
        }
        return time;
    };

    /**
        import(event, properties, callback)
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
        if (typeof(properties) === 'function' || !properties) {
            callback = properties;
            properties = {};
        }

        properties.time = parse_time(time);

        metrics.track(event, properties, callback);
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

        N.B.: the Mixpanel API only accepts 50 events per request, so regardless
        of max_batch_size, larger lists of events will be chunked further into
        groups of 50.

        event_list:array                    list of event names and properties
        options:object                      optional batch configuration
        callback:function(error_list:array) callback is called when the request is
                                            finished or an error occurs
    */
    metrics.import_batch = function(event_list, options, callback) {
        var batch_size = 50, // default: Mixpanel API permits 50 events per request
            total_events = event_list.length,
            max_simultaneous_events = total_events,
            completed_events = 0,
            event_group_idx = 0,
            request_errors = [];

        if (typeof(options) === 'function' || !options) {
            callback = options;
            options = {};
        }
        if (options.max_batch_size) {
            max_simultaneous_events = options.max_batch_size;
            if (options.max_batch_size < batch_size) {
                batch_size = options.max_batch_size;
            }
        }

        var send_next_batch = function() {
            var properties,
                event_batch = [];

            // prepare batch with required props
            for (var ei = event_group_idx; ei < total_events && ei < event_group_idx + batch_size; ei++) {
                properties = event_list[ei].properties;
                properties.time = parse_time(properties.time);
                if (!properties.token) {
                    properties.token = metrics.token;
                }
                event_batch.push(event_list[ei]);
            }

            if (event_batch.length > 0) {
                metrics.send_request('/import', event_batch, function(e) {
                    completed_events += event_batch.length;
                    if (e) {
                        request_errors.push(e);
                    }
                    if (completed_events < total_events) {
                        send_next_batch();
                    } else if (callback) {
                        callback(request_errors);
                    }
                });
                event_group_idx += batch_size;
            }
        };

        if (metrics.config.debug) {
            console.log(
                "Sending " + event_list.length + " events to Mixpanel in " +
                Math.ceil(total_events / batch_size) + " requests"
            );
        }

        for (var i = 0; i < max_simultaneous_events; i += batch_size) {
            send_next_batch();
        }
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
        /** people.set_once(distinct_id, prop, to, callback)
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
            modifiers['set_once'] = true;

            this._set(distinct_id, $set, callback, modifiers);
        },

        /**
            people.set(distinct_id, prop, to, callback)
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

            if(metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
            people.increment(distinct_id, prop, to, callback)
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

            if(metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
            people.append(distinct_id, prop, value, callback)
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

            if(metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
            people.track_charge(distinct_id, amount, properties, callback)
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

            if(metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
            people.clear_charges(distinct_id, callback)
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

            if(metrics.config.debug) {
                console.log("Clearing this user's charges:", distinct_id);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
            people.delete_user(distinct_id, callback)
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

            if(metrics.config.debug) {
                console.log("Deleting the user from engage:", distinct_id);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
         people.union(distinct_id, data, callback)
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

            if (typeof(modifiers) === 'function') { callback = modifiers; }

            data = merge_modifiers(data, modifiers);

            if (metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
         people.unset(distinct_id, prop, callback)
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

            if (typeof(modifiers) === 'function') { callback = modifiers; }

            data = merge_modifiers(data, modifiers);

            if(metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        }
    };

    var merge_modifiers = function(data, modifiers) {
        if (modifiers) {
            if (modifiers.$ignore_time) { data.$ignore_time = modifiers.$ignore_time; }
            if (modifiers.hasOwnProperty("$ip")) { data.$ip = modifiers.$ip; }
            if (modifiers.hasOwnProperty("$time")) { data.$time = parse_time(modifiers.$time); }
        }
        return data
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
