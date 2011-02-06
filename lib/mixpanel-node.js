/*
    Original source copyright Mixpanel, Inc. (http://mixpanel.com/)

	Modifications by Carl Sverre
*/

var MixpanelLib = function(token, callback_obj) {
    var metrics = {},
        super_props_loaded = false;
 
    metrics.config = {
        cross_subdomain_cookie: true,
        cookie_name: "mp_super_properties",
        test: false,
        store_google: false,
        debug: false
    };
    
    metrics.super_properties = {"all": {}, "events": {}, "funnels": {}};
    
    /*
        Pre-defined funnels:
        {
            'funnel_name': ['Event1', 'Event2', 'Event3'],
            'funnel_name2': ['Event1', 'Event3'] // 'Event3' is step 2 and step 3 in two different funnels.
        }
    */
    metrics.funnels = {};

    metrics.send_request = function(url, data) {
        var callback = metrics.callback_fn;
    
        if (url.indexOf("?") > -1) {
            url += "&callback=";
        } else {
            url += "?callback=";
        }
        url += callback + "&";
    
        if (data) { url += metrics.http_build_query(data); }
        if (metrics.config.test) { url += '&test=1'; }
        
        url += '&_=' + new Date().getTime().toString();
        var script = document.createElement("script");
        script.setAttribute("src", url);
        script.setAttribute("type", "text/javascript");
        var head = document.getElementsByTagName("head")[0] || document.documentElement;
        head.insertBefore(script, head.firstChild);
    };

    metrics.track_funnel = function(funnel, step, goal, properties, callback) {
        if (! properties) { properties = {}; }

        properties.funnel = funnel;
        properties.step = parseInt(step, 10);
        properties.goal = goal;
    
        metrics.track('mp_funnel', properties, callback, "funnels");
    };

    metrics.get_query_param = function(url, param) {
        // Expects a raw URL
    
        param = param.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
        var regexS = "[\\?&]" + param + "=([^&#]*)";
        var regex = new RegExp( regexS );
        var results = regex.exec(url);
        if (results === null || (results && typeof(results[1]) != 'string' && results[1].length)) {
            return '';
        } else {
            return unescape(results[1]).replace(/\+/g, ' ');
        }
    };

    metrics.track = function(event, properties, callback, type) {
        metrics.load_super_once();
        if (!type) { type = "events"; }
        if (!properties) { properties = {}; }
        if (!properties.token) { properties.token = metrics.token; }
        if (callback) { metrics.callback = callback; }
        properties.time = metrics.get_unixtime();
        metrics.save_campaign_params();
        metrics.save_search_keyword();

        var p;
        
        // First add specific super props
        if (type != "all") {
            for (p in metrics.super_properties[type]) {
                if (!properties[p]) {                
                    properties[p] = metrics.super_properties[type][p];
                }
            }
        }
    
        // Then add any general supers that were not in specific 
        if (metrics.super_properties.all) {
            for (p in metrics.super_properties.all) {
                if (!properties[p]) {
                    properties[p] = metrics.super_properties.all[p];
                }
            }
        }
    
        var data = {
            'event' : event,
            'properties' : properties
        };
        
        var encoded_data = metrics.base64_encode(metrics.json_encode(data)); // Security by obscurity
        
        if (metrics.config.debug) {
            if (window.console) {
                console.log("-------------- REQUEST --------------");
                console.log(data);
            }
        }
        
        metrics.send_request(
            metrics.api_host + '/track/', 
            {
                'data' : encoded_data, 
                'ip' : 1
            }
        );
        metrics.track_predefined_funnels(event, properties);
    };
    
    metrics.identify = function(person) {
        // Will bind a unique identifer to the user via a cookie (super properties)
        metrics.register_once({'distinct_id': person}, 'all', null, 30);
    };

    metrics.register_once = function(props, type, default_value, days) {
        // register properties without overriding
        metrics.load_super_once();
        if (!type || !metrics.super_properties[type]) { type = "all"; }
        if (!default_value) { default_value = "None"; }
        if (!days) { days = 7; }

        if (props) {
            for (var p in props) {
                if (props.hasOwnProperty(p)) {
                    if (!metrics.super_properties[type][p] || metrics.super_properties[type][p] == default_value) {
                        metrics.super_properties[type][p] = props[p];
                    }
                }
            }
        }
        if (metrics.config.cross_subdomain_cookie) { metrics.clear_old_cookie(); }
        metrics.set_cookie(metrics.config.cookie_name, metrics.json_encode(metrics.super_properties), days, metrics.config.cross_subdomain_cookie);
    };

    metrics.register = function(props, type, days) {
        // register a set of super properties to be included in all events and funnels
        metrics.load_super_once();
        if (!type || !metrics.super_properties[type]) { type = "all"; }
        if (!days) { days = 7; }
    
        if (props) {
            for (var p in props) {
                if (props.hasOwnProperty(p)) {
                    metrics.super_properties[type][p] = props[p];
                }
            }    
        }

        if (metrics.config.cross_subdomain_cookie) { metrics.clear_old_cookie(); }
        metrics.set_cookie(metrics.config.cookie_name, metrics.json_encode(metrics.super_properties), days, metrics.config.cross_subdomain_cookie);
    };

    metrics.http_build_query = function(formdata, arg_separator) {
        var key, use_val, use_key, i = 0, tmp_arr = [];

        if (!arg_separator) {
            arg_separator = '&';
        }

        for (key in formdata) {
            if (key) {
                use_val = encodeURIComponent(formdata[key].toString());
                use_key = encodeURIComponent(key);
                tmp_arr[i++] = use_key + '=' + use_val;
            }
        }

        return tmp_arr.join(arg_separator);
    };

    metrics.get_unixtime = function() {
        return parseInt(new Date().getTime().toString().substring(0,10), 10);
    };

    metrics.jsonp_callback = function(response) {
        if (metrics.callback) { 
            metrics.callback(response); 
            metrics.callback = false; 
        }
    };

    metrics.json_encode = function(mixed_val) {    
        var indent;
        var value = mixed_val;
        var i;

        var quote = function (string) {
            var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
            var meta = {    // table of character substitutions
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"' : '\\"',
                '\\': '\\\\'
            };

            escapable.lastIndex = 0;
            return escapable.test(string) ?
            '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ? c :
                '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' :
            '"' + string + '"';
        };

        var str = function(key, holder) {
            var gap = '';
            var indent = '    ';
            var i = 0;          // The loop counter.
            var k = '';          // The member key.
            var v = '';          // The member value.
            var length = 0;
            var mind = gap;
            var partial = [];
            var value = holder[key];

            // If the value has a toJSON method, call it to obtain a replacement value.
            if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
                value = value.toJSON(key);
            }
        
            // What happens next depends on the value's type.
            switch (typeof value) {
                case 'string':
                    return quote(value);

                case 'number':
                    // JSON numbers must be finite. Encode non-finite numbers as null.
                    return isFinite(value) ? String(value) : 'null';

                case 'boolean':
                case 'null':
                    // If the value is a boolean or null, convert it to a string. Note:
                    // typeof null does not produce 'null'. The case is included here in
                    // the remote chance that this gets fixed someday.

                    return String(value);

                case 'object':
                    // If the type is 'object', we might be dealing with an object or an array or
                    // null.
                    // Due to a specification blunder in ECMAScript, typeof null is 'object',
                    // so watch out for that case.
                    if (!value) {
                        return 'null';
                    }

                    // Make an array to hold the partial results of stringifying this object value.
                    gap += indent;
                    partial = [];

                    // Is the value an array?
                    if (Object.prototype.toString.apply(value) === '[object Array]') {
                        // The value is an array. Stringify every element. Use null as a placeholder
                        // for non-JSON values.

                        length = value.length;
                        for (i = 0; i < length; i += 1) {
                            partial[i] = str(i, value) || 'null';
                        }

                        // Join all of the elements together, separated with commas, and wrap them in
                        // brackets.
                        v = partial.length === 0 ? '[]' :
                        gap ? '[\n' + gap +
                        partial.join(',\n' + gap) + '\n' +
                        mind + ']' :
                        '[' + partial.join(',') + ']';
                        gap = mind;
                        return v;
                    }

                    // Iterate through all of the keys in the object.
                    for (k in value) {
                        if (Object.hasOwnProperty.call(value, k)) {
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (gap ? ': ' : ':') + v);
                            }
                        }
                    }

                    // Join all of the member texts together, separated with commas,
                    // and wrap them in braces.
                    v = partial.length === 0 ? '{}' :
                    gap ? '{' + partial.join(',') + '' +
                    mind + '}' : '{' + partial.join(',') + '}';
                    gap = mind;
                    return v;
            }
        };

        // Make a fake root object containing our value under the key of ''.
        // Return the result of stringifying the value.
        return str('', {
            '': value
        });
    };

    metrics.base64_encode = function(data) {        
        var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc="", tmp_arr = [];

        if (!data) {
            return data;
        }

        data = metrics.utf8_encode(data+'');
    
        do { // pack three octets into four hexets
            o1 = data.charCodeAt(i++);
            o2 = data.charCodeAt(i++);
            o3 = data.charCodeAt(i++);

            bits = o1<<16 | o2<<8 | o3;

            h1 = bits>>18 & 0x3f;
            h2 = bits>>12 & 0x3f;
            h3 = bits>>6 & 0x3f;
            h4 = bits & 0x3f;

            // use hexets to index into b64, and append result to encoded string
            tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
        } while (i < data.length);
    
        enc = tmp_arr.join('');
    
        switch( data.length % 3 ){
            case 1:
                enc = enc.slice(0, -2) + '==';
            break;
            case 2:
                enc = enc.slice(0, -1) + '=';
            break;
        }

        return enc;
    };

    metrics.utf8_encode = function (string) {
        string = (string+'').replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        var utftext = "";
        var start, end;
        var stringl = 0;

        start = end = 0;
        stringl = string.length;
        for (var n = 0; n < stringl; n++) {
            var c1 = string.charCodeAt(n);
            var enc = null;

            if (c1 < 128) {
                end++;
            } else if((c1 > 127) && (c1 < 2048)) {
                enc = String.fromCharCode((c1 >> 6) | 192) + String.fromCharCode((c1 & 63) | 128);
            } else {
                enc = String.fromCharCode((c1 >> 12) | 224) + String.fromCharCode(((c1 >> 6) & 63) | 128) + String.fromCharCode((c1 & 63) | 128);
            }
            if (enc !== null) {
                if (end > start) {
                    utftext += string.substring(start, end);
                }
                utftext += enc;
                start = end = n+1;
            }
        }

        if (end > start) {
            utftext += string.substring(start, string.length);
        }

        return utftext;
    };

    metrics.set_cookie = function(name, value, expiredays, cross_subdomain) {
        var expiration = new Date(),
            domain = ((cross_subdomain) ? metrics.parse_domain(document.location.hostname) : ""),
            cookiestring = name + "=" + escape(value);
        
        expiration.setDate(expiration.getDate()+expiredays);
        cookiestring += ((expiredays===null) ? "" : ";expires=" + expiration.toGMTString());
        cookiestring += "; path=/";
        cookiestring += ((domain) ? ";domain=." + domain : ""); 
        document.cookie = cookiestring;
    };

    metrics.get_cookie = function(name) {
        var c_start, c_end;
        
        if (document.cookie.length > 0) {
            if (document.cookie.match('^' + name + '=')) {
                c_start = 0;
            } else {
                c_start = document.cookie.search('; ' + name + '=');
                if (c_start != -1) { c_start += 2; }
            }
            if (c_start != -1) {
                c_start = c_start + name.length + 1;
                c_end = document.cookie.indexOf(";", c_start);
                if (c_end == -1) { c_end = document.cookie.length; }
                return unescape(document.cookie.substring(c_start, c_end));
            }
        }
        return "";
    };

    metrics.delete_cookie = function(name, cross_subdomain) {
        metrics.set_cookie(name, '', -1, cross_subdomain);
    };
    
    metrics.parse_domain = function(url) {
        var matches = url.match(/[a-z0-9][a-z0-9\-]+\.[a-z\.]{2,6}$/i);
        return matches ? matches[0] : '';
    };
    
    metrics.get_super = function() {
        var cookie_props = eval('(' + metrics.get_cookie(metrics.config.cookie_name) + ')');
    
        if (cookie_props) {
            for (var i in cookie_props) {
                if (cookie_props.hasOwnProperty(i)) { 
                    metrics.super_properties[i] = cookie_props[i]; 
                }
            }
        }

        return metrics.super_properties;
    };
    
    metrics.load_super_once = function() {
        if (!super_props_loaded) {
            try {
                metrics.get_super();
                super_props_loaded = true;
            } catch(err) {}
        }
    };
    
    metrics.register_funnel = function(funnel_name, steps) {
        metrics.funnels[funnel_name] = steps;
    };
    
    metrics.track_predefined_funnels = function(event, properties) {
        if (event && metrics.funnels) {
            for (var funnel in metrics.funnels) {
                if (metrics.funnels.hasOwnProperty(funnel)) {
                    for (var i = 0; i < metrics.funnels[funnel].length; ++i) {
                        if (metrics.funnels[funnel][i]) {
                            if (metrics.funnels[funnel][i] == event) {
                                // Somewhat inefficient, todo: batch requests one day?
                                metrics.track_funnel(funnel, i+1, event, properties);
                            }
                        }
                    }
                }
            }
        }
    };
    
    metrics.save_campaign_params = function() {
        // Save AdWords campaign information as properties
        metrics.campaign_params_saved = metrics.campaign_params_saved || false;
        if (metrics.config.store_google && !metrics.campaign_params_saved) {
            var campaign_keywords = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
                kw = '',
                params = {};
            for (var ki = 0; ki < campaign_keywords.length; ki++) {
                kw = metrics.get_query_param(document.URL, campaign_keywords[ki]);
                if (kw.length) {
                    params[campaign_keywords[ki]] = kw;
                }
            }
            metrics.register_once(params);
            metrics.campaign_params_saved = true;
        }
    };
    
    metrics.save_search_keyword = function() {
        if (document.referrer.search('http://(.*)google.com') === 0) {
            var keyword = metrics.get_query_param(document.referrer, 'q');
            if (keyword.length) {
                metrics.register({'mp_keyword' : keyword}, 'all');
            }
        }
    };
    
    metrics.clear_old_cookie = function() {
        // Delete old non-crossdomain cookie
        metrics.delete_cookie(metrics.config.cookie_name, false);
        // Save the new cookie with domain=.example.com (works across subdomains)
        metrics.set_cookie(metrics.config.cookie_name, metrics.json_encode(metrics.super_properties), 7, true);
    };

    metrics.set_config = function(configuration) {
        for (var c in configuration) {
            if (configuration.hasOwnProperty(c)) {
                metrics.config[c] = configuration[c];
            }
        }
    };

    // Initiation
    var mp_protocol = (("https:" == document.location.protocol) ? "https://" : "http://");
    metrics.token = token;
    metrics.api_host = mp_protocol + 'api.mixpanel.com';
    
    if (callback_obj) {
        metrics.callback_fn = callback_obj + '.jsonp_callback';
    } else {
        metrics.callback_fn = 'mpmetrics.jsonp_callback';
    }
        
    return metrics;
};

if (typeof mpq != 'undefined' && mpq && mpq[0] && mpq[0][0] == 'init') {
    mpq.metrics = new MixpanelLib(mpq[0][1], "mpq.metrics");
    mpq.push = function(item) {
        if (item) {
            if (typeof item == 'function') {
                item();
            } else if (item.constructor == Array) {
                var f = mpq.metrics[item[0]];
                if (typeof f == 'function') {
                    f.apply(mpq.metrics, item.slice(1));
                }
            }
        }
    };
    for (var i = 1; i < mpq.length; i++) {
        mpq.push(mpq[i]);
    }
    mpq.length = 0;
}
