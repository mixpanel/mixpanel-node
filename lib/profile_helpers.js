const util = require('util');
const {ensure_timestamp} = require('./utils');

function merge_modifiers(data, modifiers) {
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
exports.merge_modifiers = merge_modifiers;

// used internally by set and set_once
// identifiers is one of {$distinct_id} or {$group_key, $group_id}
exports._set = function(prop, to, modifiers, callback, {identifiers, set_once = false, token, endpoint, send_request, config}) {
    let $set = {};

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

    let data = {
        '$token': token,
        ...identifiers,
    };

    const set_key = set_once ? "$set_once" : "$set";
    data[set_key] = $set;

    if ('ip' in $set) {
        data.$ip = $set.ip;
        delete $set.ip;
    }

    if ($set.$ignore_time) {
        data.$ignore_time = $set.$ignore_time;
        delete $set.$ignore_time;
    }

    data = merge_modifiers(data, modifiers);

    if (config.debug) {
        console.log(`Sending the following data to Mixpanel (${endpoint}):`);
        console.log(data);
    }

    send_request({ method: "GET", endpoint, data }, callback);
};

// used internally by mixpanel.people.delete_user and mixpanel.groups.delete_group
exports._delete_profile = function({identifiers, modifiers, callback, endpoint, token, send_request, config}){
    let data = {
        '$delete': '',
        '$token': token,
        ...identifiers,
    };

    if (typeof(modifiers) === 'function') { callback = modifiers; }

    data = merge_modifiers(data, modifiers);

    if (config.debug) {
        console.log(`Deleting profile ${JSON.stringify(identifiers)}`);
    }

    send_request({ method: "GET", endpoint, data }, callback);
};

// used internally by mixpanel.people.remove and mixpanel.groups.remove
exports._remove = function({identifiers, data, modifiers, callback, endpoint, token, send_request, config}) {
    let $remove = {};

    if (typeof(data) !== 'object' || util.isArray(data)) {
        if (config.debug) {
            console.error("Invalid value passed to #remove - data must be an object with scalar values");
        }
        return;
    }

    for (const [key, val] of Object.entries(data)) {
        if (typeof(val) === 'string' || typeof(val) === 'number') {
            $remove[key] = val;
        } else {
            if (config.debug) {
                console.error("Invalid argument passed to #remove - values must be scalar");
                console.error("Passed " + key + ':', val);
            }
            return;
        }
    }

    if (Object.keys($remove).length === 0) {
        return;
    }

    data = {
        '$remove': $remove,
        '$token': token,
        ...identifiers
    };

    if (typeof(modifiers) === 'function') {
        callback = modifiers;
    }

    data = merge_modifiers(data, modifiers);

    if (config.debug) {
        console.log(`Sending the following data to Mixpanel (${endpoint}):`);
        console.log(data);
    }

    send_request({ method: "GET", endpoint, data }, callback);
};

// used internally by mixpanel.people.union and mixpanel.groups.union
exports._union = function({identifiers, data, modifiers, callback, endpoint, token, send_request, config}) {
    let $union = {};

    if (typeof(data) !== 'object' || util.isArray(data)) {
        if (config.debug) {
            console.error("Invalid value passed to #union - data must be an object with scalar or array values");
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
            if (config.debug) {
                console.error("Invalid argument passed to #union - values must be a scalar value or array");
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
        '$token': token,
        ...identifiers,
    };

    if (typeof(modifiers) === 'function') {
        callback = modifiers;
    }

    data = merge_modifiers(data, modifiers);

    if (config.debug) {
        console.log(`Sending the following data to Mixpanel (${endpoint}):`);
        console.log(data);
    }

    send_request({ method: "GET", endpoint, data }, callback);
};

// used internally by mixpanel.people.unset and mixpanel.groups.unset
exports._unset = function({identifiers, prop, modifiers, callback, endpoint, token, send_request, config}){
    let $unset = [];

    if (util.isArray(prop)) {
        $unset = prop;
    } else if (typeof(prop) === 'string') {
        $unset = [prop];
    } else {
        if (config.debug) {
            console.error("Invalid argument passed to #unset - must be a string or array");
            console.error("Passed: " + prop);
        }
        return;
    }

    let data = {
        '$unset': $unset,
        '$token': token,
        ...identifiers,
    };

    if (typeof(modifiers) === 'function') {
        callback = modifiers;
    }

    data = merge_modifiers(data, modifiers);

    if (config.debug) {
        console.log(`Sending the following data to Mixpanel (${endpoint}):`);
        console.log(data);
    }

    send_request({ method: "GET", endpoint, data }, callback);
};
