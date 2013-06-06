/*
 Heavily inspired by the original js library copyright Mixpanel, Inc.
 (http://mixpanel.com/)

 Copyright (c) 2012 Carl Sverre

 Released under the MIT license.
 */

var http = require('http'),
    querystring = require('querystring'),
    Buffer = require('buffer').Buffer,
    md5 = require('MD5');

var create_client = function (token, config) {
    var metrics = {};

    if (!token) {
        throw new Error("The Mixpanel Client needs a Mixpanel token: `init(token)`");
    }

    metrics.config = {
        test:false,
        debug:false
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
    metrics.send_request = function (endpoint, data, callback) {
        callback = callback || function() {};
        var event_data = new Buffer(JSON.stringify(data));
        var request_data = {
            'data':event_data.toString('base64'),
            'ip':0
        };

        if (endpoint === '/import') {
            var key = metrics.config.key;
            if (!key) {
                throw new Error("The Mixpanel Client needs a Mixpanel api key when importing old events: `init(token, { key: ... })`");
            }
            request_data.api_key = key;
        }

        var request_options = {
            host:'api.mixpanel.com',
            port:80,
            headers:{}
        };

        if (metrics.config.test) { request_data.test = 1; }

        var query = querystring.stringify(request_data);

        request_options.path = [endpoint, "?", query].join("");

        http.get(request_options,function (res) {
            var data = "";
            res.on('data', function (chunk) {
                data += chunk;
            });

            res.on('end', function () {
                var e = (data != '1') ? new Error("Mixpanel Server Error: " + data) : undefined;
                callback(e);
            });
        }).on('error', function (e) {
                if (metrics.config.debug) {
                    console.log("Got Error: " + e.message);
                }
                callback(e);
            });
    };

    /**
     generate_signature(data)
     ---
     this function generates a request signature

     data:object                     the data to send in the request
     */
    metrics.generate_signature = function(data) {

        var keys = [];

        for(var key in data) {
            keys.push(key);
        }
        keys.sort();

        var unhashed = "";
        for(var i=0;i<keys.length;i++) {
            unhashed += keys[i] + "=" + data[keys[i]];
        }

        return md5(unhashed + metrics.config.secret);
    };

    /**
     send_export_request(data)
     ---
     this function sends an async GET request to mixpanel

     data:object                     the data to send in the request
     callback:function(err:Error)    callback is called when the request is
     finished or an error occurs
     */
    metrics.send_export_request = function (endpoint, data, callback) {
        callback = callback || function() {};

        if (!metrics.config.key) {
            throw new Error("The Mixpanel Client needs a Mixpanel api key when exporting data: `init(token, { key: ... , secret: ... })`");
        }
        data.api_key = metrics.config.key;
        data.token = metrics.token;
        if (metrics.config.secret === undefined) {
            throw new Error("The Mixpanel Client needs a Mixpanel secret key when exporting data: `init(token, { key: ... , secret: ... })`");
        }

        var request_options = {
            host:"mixpanel.com",
            port:80,
            headers:{}
        };

        if (metrics.config.test) { data.test = 1; }

        data.expire = new Date().getTime()+(60 * 1000);
        data.sig = metrics.generate_signature(data);
        var query = querystring.stringify(data);

        request_options.path = ["/api/2.0" + endpoint, "?", query].join("");

        http.get(request_options,function (res) {
            var data = "";
            res.on('data', function (chunk) {
                data += chunk;
            });

            res.on('end', function () {
                callback(null, JSON.parse(data));
            });
        }).on('error', function (e) {
                if (metrics.config.debug) {
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
    metrics.track = function (event, properties, callback) {
        if (typeof(properties) === 'function' || !properties) {
            callback = properties;
            properties = {};
        }

        var endpoint = '/track';
        var data = {
            'event':event,
            'properties':properties
        };

        if (typeof(properties.time) === 'number') // if properties.time exists, use import endpoint
            endpoint = '/import';

        else if (properties.funnel_id !== undefined) { // if properties.funnel exists, use import endpoint
            endpoint = '/funnels';
            data = properties;
        }

        if (metrics.config.debug) {
            console.log("Sending the following event to Mixpanel:");
            console.log(data);
        }

        properties.token = metrics.token;
        properties.mp_lib = "node";


        metrics.send_request(endpoint, data, callback);
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
    metrics.import = function (event, time, properties, callback) {
        if (typeof(properties) === 'function' || !properties) {
            callback = properties;
            properties = {};
        }

        if (time === void 0) {
            throw new Error("The import method requires you to specify the time of the event");
        } else if (Object.prototype.toString.call(time) === '[object Date]') {
            time = Math.floor(time.getTime() / 1000);
        }

        properties.time = time;

        metrics.track(event, properties, callback);
    };

    metrics.data_export = {
        funnels : {
            /** funnels.get(funnel_id, params, callback)
             ---
             Get data for a funnel.

             funnel_id:string                    id of the funnel
             params:object                       additional params to send
             callback:function(err:Error, data:object)    callback is called when the request is
             finished or an error occurs
             */
            get: function (funnel_id, params, callback) {
              if (typeof(params) === 'function' || !params) {
                  callback = params;
                  params = {};
              }

              if (funnel_id === null) {
                  throw new Error("The funnels method requires you to specify a funnel ID");
              }

              params.funnel_id = funnel_id;
              if (metrics.config.debug) {
                  console.log("Fetching funnel from Mixpanel:");
                  console.log(params);
              }

                metrics.send_export_request("/funnels", params, callback);
          },
            /** funnels.list(callback)
             ---
             Get the names and funnel_ids of your funnels.

             callback:function(err:Error, data:object)    callback is called when the request is
             finished or an error occurs
             */
            list: function (callback) {
                if (!callback) {
                    callback= {};
                }
                if (metrics.config.debug) {
                    console.log("Fetching funnels from Mixpanel:");
                }

                metrics.send_export_request("/funnels/list", {}, callback);
            }

        }
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
        set_once:function (distinct_id, prop, to, callback) {
            var $set = {}, data = {};

            if (typeof(prop) === 'object') {
                callback = to;
                $set = prop;
            } else {
                $set[prop] = to;
            }

            this._set(distinct_id, $set, callback, { set_once:true })
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
        set:function (distinct_id, prop, to, callback) {
            var $set = {}, data = {};

            if (typeof(prop) === 'object') {
                callback = to;
                $set = prop;
            } else {
                $set[prop] = to;
            }

            this._set(distinct_id, $set, callback)
        },

        // used internally by set and set_once
        _set:function (distinct_id, $set, callback, options) {
            var set_key = (options && options["set_once"]) ? "$set_once" : "$set";

            var data = {
                '$token':metrics.token,
                '$distinct_id':distinct_id
            }
            data[set_key] = $set;

            if ($set['ip']) {
                data['$ip'] = $set['ip'];
                delete $set['ip'];
            }

            if ($set['$ignore_time']) {
                data['$ignore_time'] = $set['$ignore_time'];
                delete $set['$ignore_time'];
            }

            if (metrics.config.debug) {
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
        increment:function (distinct_id, prop, by, callback) {
            var $add = {}, data = {};

            if (typeof(prop) === 'object') {
                callback = by;
                Object.keys(prop).forEach(function (key) {
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
                if (!by) { by = 1; }
                $add[prop] = by;
            }

            var data = {
                '$add':$add,
                '$token':metrics.token,
                '$distinct_id':distinct_id
            }

            if (metrics.config.debug) {
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
        track_charge:function (distinct_id, amount, properties, callback) {
            var $append = {}, data = {};

            if (!properties) { properties = {}; }

            if (typeof(amount) !== 'number') {
                amount = parseFloat(amount);
                if (isNaN(amount)) {
                    console.error("Invalid value passed to mixpanel.people.track_charge - must be a number");
                    return;
                }
            }

            properties['$amount'] = amount;

            if (properties.hasOwnProperty('$time')) {
                var time = properties['$time'];
                if (Object.prototype.toString.call(time) === '[object Date]') {
                    properties['$time'] = time.toISOString();
                }
            }

            var data = {
                '$append':{ '$transactions':properties },
                '$token':metrics.token,
                '$distinct_id':distinct_id
            }

            if (metrics.config.debug) {
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
        clear_charges:function (distinct_id, callback) {
            var data = {
                '$set':{ '$transactions':[] },
                '$token':metrics.token,
                '$distinct_id':distinct_id
            };

            if (metrics.config.debug) {
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
        delete_user:function (distinct_id, callback) {
            var data = {
                '$delete':distinct_id,
                '$token':metrics.token,
                '$distinct_id':distinct_id
            };

            if (metrics.config.debug) {
                console.log("Deleting the user from engage:", distinct_id);
            }

            metrics.send_request('/engage', data, callback);
        }
    };

    /**
     set_config(config)
     ---
     Modifies the mixpanel config

     config:object       an object with properties to override in the
     mixpanel client config
     */
    metrics.set_config = function (config) {
        for (var c in config) {
            if (config.hasOwnProperty(c)) {
                metrics.config[c] = config[c];
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
    Client:function (token) {
        console.warn("The function `Client(token)` is deprecated.  It is now called `init(token)`.");
        return create_client(token);
    },
    init:create_client
};
