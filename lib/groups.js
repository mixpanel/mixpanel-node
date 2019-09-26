const {_set, _delete_profile, _remove, _union, _unset} = require('./profile_helpers');

/* Group profile methods. Learn more: https://help.mixpanel.com/hc/en-us/articles/360025333632  */
exports.create_group_funcs = function({config, token, send_request}){
    const GROUPS_ENDPOINT = "/groups";
    return {
        /** groups.set_once(group_key, group_id, prop, to, modifiers, callback)
         ---
         The same as groups.set, but adds a property value to a group only if it has not been set before.
         */
        set_once: function(group_key, group_id, prop, to, modifiers, callback) {
            const identifiers = {$group_key: group_key, $group_id: group_id};
            _set(prop, to, modifiers, callback, {
                identifiers,
                set_once: true,
                token,
                endpoint: GROUPS_ENDPOINT,
                send_request,
                config,
            });
        },

        /**
         groups.set(group_key, group_id, prop, to, modifiers, callback)
         ---
         set properties on a group profile

         usage:

         mixpanel.groups.set('company', 'Acme Inc.', 'Industry', 'Widgets');

         mixpanel.groups.set('company', 'Acme Inc.', {
             'Industry': 'widgets',
             'Plan': 'premium'
         });
         */
        set: function(group_key, group_id, prop, to, modifiers, callback) {
            const identifiers = {$group_key: group_key, $group_id: group_id};
            _set(prop, to, modifiers, callback, {
                identifiers,
                token,
                endpoint: GROUPS_ENDPOINT,
                send_request,
                config,
            });
        },


        /**
         groups.delete_group(group_key, group_id, modifiers, callback)
         ---
         delete a group profile permanently

         usage:

         mixpanel.groups.delete_group('company', 'Acme Inc.');
         */
        delete_group: function(group_key, group_id, modifiers, callback) {
            const identifiers = {$group_key: group_key, $group_id: group_id};
            _delete_profile({identifiers, modifiers, callback, endpoint: GROUPS_ENDPOINT, token, send_request, config});
        },

        /**
         groups.remove(group_key, group_id, data, modifiers, callback)
         ---
         remove a value from a list-valued group profile property.

         usage:

         mixpanel.groups.remove('company', 'Acme Inc.', {'products': 'anvil'});

         mixpanel.groups.remove('company', 'Acme Inc.', {
             'products': 'anvil',
             'customer segments': 'coyotes'
         });
         */
        remove: function(group_key, group_id, data, modifiers, callback) {
            const identifiers = {$group_key: group_key, $group_id: group_id};
            _remove({identifiers, data, modifiers, callback, endpoint: GROUPS_ENDPOINT, token, send_request, config});
        },

        /**
         groups.union(group_key, group_id, data, modifiers, callback)
         ---
         merge value(s) into a list-valued group profile property.

         usage:

         mixpanel.groups.union('company', 'Acme Inc.', {'products': 'anvil'});

         mixpanel.groups.union('company', 'Acme Inc.', {'products': ['anvil'], 'customer segments': ['coyotes']});
         */
        union: function(group_key, group_id, data, modifiers, callback) {
            const identifiers = {$group_key: group_key, $group_id: group_id};
            _union({identifiers, data, modifiers, callback, endpoint: GROUPS_ENDPOINT, token, send_request, config})
        },

        /**
         groups.unset(group_key, group_id, prop, modifiers, callback)
         ---
         delete a property on a group profile

         usage:

         mixpanel.groups.unset('company', 'Acme Inc.', 'products');

         mixpanel.groups.unset('company', 'Acme Inc.', ['products', 'customer segments']);
         */
        unset: function(group_key, group_id, prop, modifiers, callback) {
            const identifiers = {$group_key: group_key, $group_id: group_id};
            _unset({identifiers, prop, modifiers, callback, endpoint: GROUPS_ENDPOINT, token, send_request, config})
        }
    };
}
