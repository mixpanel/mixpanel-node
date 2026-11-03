/**
 * Group profile methods. Learn more: https://help.mixpanel.com/hc/en-us/articles/360025333632
 */

const { ProfileHelpers } = require("./profile_helpers");
const { MixpanelCompanyRequiredError } = require("./errors");

class MixpanelGroups extends ProfileHelpers() {
  constructor(mp_instance) {
    super();
    this.mixpanel = mp_instance;
    this.endpoint = "/groups";
  }

  /**
   * Adds the client's bound company (see `mixpanel.for_company`), else a
   * `$company_id` modifier, as a top-level `$company_id`. Hierarchical groups
   * clients require one of them.
   */
  _target(identifiers, modifiers) {
    return this._group_target(identifiers, this.mixpanel.company_id, modifiers);
  }

  /** groups.set_once(group_key, group_id, prop, to, modifiers, callback)
        ---
        The same as groups.set, but adds a property value to a group only if it has not been set before.
    */
  set_once(group_key, group_id, prop, to, modifiers, callback) {
    const identifiers = { $group_key: group_key, $group_id: group_id };
    this._set(prop, to, modifiers, callback, { identifiers, set_once: true });
  }

  /**
        groups.set(group_key, group_id, prop, to, modifiers, callback)
        ---
        set properties on a group profile

        usage:

            mixpanel.groups.set('company', 'Acme Inc.', '$name', 'Acme Inc.');

            mixpanel.groups.set('company', 'Acme Inc.', {
                'Industry': 'widgets',
                '$name': 'Acme Inc.',
            });
    */
  set(group_key, group_id, prop, to, modifiers, callback) {
    const identifiers = { $group_key: group_key, $group_id: group_id };
    this._set(prop, to, modifiers, callback, { identifiers });
  }

  /**
     groups.delete_group(group_key, group_id, modifiers, callback)
        ---
        delete a group profile permanently

        usage:

        mixpanel.groups.delete_group('company', 'Acme Inc.');
        */
  delete_group(group_key, group_id, modifiers, callback) {
    const identifiers = { $group_key: group_key, $group_id: group_id };
    this._delete_profile({ identifiers, modifiers, callback });
  }

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
  remove(group_key, group_id, data, modifiers, callback) {
    const identifiers = { $group_key: group_key, $group_id: group_id };
    this._remove({ identifiers, data, modifiers, callback });
  }

  /**
     groups.union(group_key, group_id, data, modifiers, callback)
        ---
        merge value(s) into a list-valued group profile property.

        usage:

        mixpanel.groups.union('company', 'Acme Inc.', {'products': 'anvil'});

        mixpanel.groups.union('company', 'Acme Inc.', {'products': ['anvil'], 'customer segments': ['coyotes']});
        */
  union(group_key, group_id, data, modifiers, callback) {
    const identifiers = { $group_key: group_key, $group_id: group_id };
    this._union({ identifiers, data, modifiers, callback });
  }

  /**
     groups.unset(group_key, group_id, prop, modifiers, callback)
        ---
        delete a property on a group profile

        usage:

        mixpanel.groups.unset('company', 'Acme Inc.', 'products');

        mixpanel.groups.unset('company', 'Acme Inc.', ['products', 'customer segments']);
        */
  unset(group_key, group_id, prop, modifiers, callback) {
    const identifiers = { $group_key: group_key, $group_id: group_id };
    this._unset({ identifiers, prop, modifiers, callback });
  }
}

/**
 * The bound company's own profile (see `mixpanel.for_company`). Each method is
 * the matching `groups` method with `('$company_id', <bound company id>)`, so
 * the company is named once.
 */
class MixpanelCompany {
  constructor(mp_instance) {
    this.mixpanel = mp_instance;
  }

  /**
   * The bound client's groups, called with the company profile's key and id.
   * Throws MixpanelCompanyRequiredError on a client without a bound company.
   */
  _groups(method, ...args) {
    const company_id = this.mixpanel.company_id;
    if (!company_id) {
      throw new MixpanelCompanyRequiredError(
        "Company profile updates require a company. " +
          "Use mixpanel.for_company(company_id) to send them. Nothing sent for " +
          `company.${method}`,
      );
    }
    this.mixpanel.groups[method]("$company_id", company_id, ...args);
  }

  /**
        company.set(prop, to, modifiers, callback)
        ---
        set properties on the bound company's profile

        usage:

            const acme = mixpanel.for_company('acme');
            acme.company.set({ tier: 'enterprise' });
    */
  set(prop, to, modifiers, callback) {
    this._groups("set", prop, to, modifiers, callback);
  }

  /**
        company.set_once(prop, to, modifiers, callback)
        ---
        The same as company.set, but adds a property value only if it has not been set before.
    */
  set_once(prop, to, modifiers, callback) {
    this._groups("set_once", prop, to, modifiers, callback);
  }

  /**
        company.union(data, modifiers, callback)
        ---
        merge value(s) into a list-valued property of the bound company's profile

        usage:

        mixpanel.for_company('acme').company.union({'products': 'anvil'});
    */
  union(data, modifiers, callback) {
    this._groups("union", data, modifiers, callback);
  }

  /**
        company.remove(data, modifiers, callback)
        ---
        remove a value from a list-valued property of the bound company's profile

        usage:

        mixpanel.for_company('acme').company.remove({'products': 'anvil'});
    */
  remove(data, modifiers, callback) {
    this._groups("remove", data, modifiers, callback);
  }

  /**
        company.unset(prop, modifiers, callback)
        ---
        delete a property on the bound company's profile

        usage:

        mixpanel.for_company('acme').company.unset(['products', 'customer segments']);
    */
  unset(prop, modifiers, callback) {
    this._groups("unset", prop, modifiers, callback);
  }

  /**
        company.delete(modifiers, callback)
        ---
        delete the bound company's profile permanently

        usage:

        mixpanel.for_company('acme').company.delete();
    */
  delete(modifiers, callback) {
    this._groups("delete_group", modifiers, callback);
  }
}

exports.MixpanelGroups = MixpanelGroups;
exports.MixpanelCompany = MixpanelCompany;
