/**
 * Mixin with profile-related helpers (for people and groups)
 */

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
        if (modifiers.hasOwnProperty("$latitude") && modifiers.hasOwnProperty('$longitude')) {
            data.$latitude = modifiers.$latitude;
            data.$longitude = modifiers.$longitude;
        }
    }
    return data;
};
exports.merge_modifiers = merge_modifiers;

exports.ProfileHelpers = (Base = Object) => class extends Base {
    get token() {
        return this.mixpanel.token;
    }

    get config() {
        return this.mixpanel.config;
    }

    _set(prop, to, modifiers, callback, {identifiers, set_once = false}) {
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
            '$token': this.token,
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

        if (this.config.debug) {
            this.mixpanel.config.logger.debug(`Sending the following data to Mixpanel (${this.endpoint})`, { data });
        }

        this.mixpanel.send_request({ method: "GET", endpoint: this.endpoint, data }, callback);
    }

    _delete_profile({identifiers, modifiers, callback}){
        let data = {
            '$delete': '',
            '$token': this.token,
            ...identifiers,
        };

        if (typeof(modifiers) === 'function') { callback = modifiers; }

        data = merge_modifiers(data, modifiers);

        if (this.config.debug) {
            this.mixpanel.config.logger.debug('Deleting profile', { identifiers });
        }

        this.mixpanel.send_request({ method: "GET", endpoint: this.endpoint, data }, callback);
    }

    _remove({identifiers, data, modifiers, callback}) {
        let $remove = {};

        if (typeof(data) !== 'object' || Array.isArray(data)) {
            if (this.config.debug) {
                this.mixpanel.config.logger.error("Invalid value passed to #remove - data must be an object with scalar values");
            }
            return;
        }

        for (const [key, val] of Object.entries(data)) {
            if (typeof(val) === 'string' || typeof(val) === 'number') {
                $remove[key] = val;
            } else {
                if (this.config.debug) {
                    this.mixpanel.config.logger.error(
                        "Invalid argument passed to #remove - values must be scalar",
                        { key, value: val }
                    );
                }
                return;
            }
        }

        if (Object.keys($remove).length === 0) {
            return;
        }

        data = {
            '$remove': $remove,
            '$token': this.token,
            ...identifiers
        };

        if (typeof(modifiers) === 'function') {
            callback = modifiers;
        }

        data = merge_modifiers(data, modifiers);

        if (this.config.debug) {
            this.mixpanel.config.logger.debug(
                `Sending the following data to Mixpanel (${this.endpoint})`,
                { data }
            );
        }

        this.mixpanel.send_request({ method: "GET", endpoint: this.endpoint, data }, callback);
    }

    _union({identifiers, data, modifiers, callback}) {
        let $union = {};

        if (typeof(data) !== 'object' || Array.isArray(data)) {
            if (this.config.debug) {
                this.mixpanel.config.logger.error("Invalid value passed to #union - data must be an object with scalar or array values");
            }
            return;
        }

        for (const [key, val] of Object.entries(data)) {
            if (Array.isArray(val)) {
                var merge_values = val.filter(function(v) {
                    return typeof(v) === 'string' || typeof(v) === 'number';
                });
                if (merge_values.length > 0) {
                    $union[key] = merge_values;
                }
            } else if (typeof(val) === 'string' || typeof(val) === 'number') {
                $union[key] = [val];
            } else {
                if (this.config.debug) {
                    this.mixpanel.config.logger.error(
                        "Invalid argument passed to #union - values must be a scalar value or array",
                        { key, value: val }
                    );
                }
            }
        }

        if (Object.keys($union).length === 0) {
            return;
        }

        data = {
            '$union': $union,
            '$token': this.token,
            ...identifiers,
        };

        if (typeof(modifiers) === 'function') {
            callback = modifiers;
        }

        data = merge_modifiers(data, modifiers);

        if (this.config.debug) {
            this.mixpanel.config.logger.debug(
                `Sending the following data to Mixpanel (${this.endpoint})`,
                { data }
            );
        }

        this.mixpanel.send_request({ method: "GET", endpoint: this.endpoint, data }, callback);
    }

    _unset({identifiers, prop, modifiers, callback}){
        let $unset = [];

        if (Array.isArray(prop)) {
            $unset = prop;
        } else if (typeof(prop) === 'string') {
            $unset = [prop];
        } else {
            if (this.config.debug) {
                this.mixpanel.config.logger.error(
                    "Invalid argument passed to #unset - must be a string or array",
                    { prop }
                );
            }
            return;
        }

        let data = {
            '$unset': $unset,
            '$token': this.token,
            ...identifiers,
        };

        if (typeof(modifiers) === 'function') {
            callback = modifiers;
        }

        data = merge_modifiers(data, modifiers);

        if (this.config.debug) {
            this.mixpanel.config.logger.debug(
                `Sending the following data to Mixpanel (${this.endpoint})`,
                { data }
            );
        }

        this.mixpanel.send_request({ method: "GET", endpoint: this.endpoint, data }, callback);
    }
};
