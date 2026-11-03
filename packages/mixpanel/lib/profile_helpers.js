/**
 * Mixin with profile-related helpers (for people and groups)
 */

const { ensure_timestamp } = require("./utils");
const {
  MixpanelArgumentError,
  MixpanelCompanyRequiredError,
} = require("./errors");

// /groups has no $add, $append or $merge, so these are all a hierarchical
// groups profile supports
const GROUP_OPERATIONS = Object.freeze([
  "$set",
  "$set_once",
  "$unset",
  "$union",
  "$remove",
  "$delete",
]);
exports.GROUP_OPERATIONS = GROUP_OPERATIONS;

/** modifiers can be omitted, in which case the callback takes their place */
function modifiers_or_none(modifiers) {
  return modifiers && typeof modifiers === "object" ? modifiers : undefined;
}

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
    if (
      modifiers.hasOwnProperty("$latitude") &&
      modifiers.hasOwnProperty("$longitude")
    ) {
      data.$latitude = modifiers.$latitude;
      data.$longitude = modifiers.$longitude;
    }
  }
  return data;
}
exports.merge_modifiers = merge_modifiers;

exports.ProfileHelpers = (Base = Object) =>
  class extends Base {
    get token() {
      return this.mixpanel.token;
    }

    get config() {
      return this.mixpanel.config;
    }

    /**
     * Resolves where a profile update goes. Called before the message is
     * built, so a caller wiring mistake throws even when the data is invalid.
     * @param {object} identifiers - as passed by the people/groups method
     * @param {object} [modifiers]
     * @returns {{endpoint: string, identifiers: object, company_id?: string}}
     */
    _target(identifiers, _modifiers) {
      return { endpoint: this.endpoint, identifiers };
    }

    /**
     * Target for a group profile. Hierarchical groups projects require a
     * top-level $company_id on every /groups write, so the company comes from
     * the given company_id, else a $company_id modifier. A `$company_id` group
     * profile is the company's own profile, so without either its company is
     * its group id.
     */
    _group_target(identifiers, company_id, modifiers) {
      modifiers = modifiers_or_none(modifiers);
      // a $company_id modifier is only honoured on hierarchical groups clients;
      // other clients drop it, as they always have
      let company =
        company_id ||
        (this.mixpanel.hierarchical_groups &&
          modifiers &&
          modifiers.$company_id) ||
        undefined;
      if (
        this.mixpanel.hierarchical_groups &&
        identifiers.$group_key === "$company_id"
      ) {
        const group_id = identifiers.$group_id;
        if (!company) {
          company = group_id;
        } else if (String(company) !== String(group_id)) {
          throw new MixpanelArgumentError(
            `The company profile $company_id=${group_id} belongs to company ` +
              `${group_id}, its own id, not ${company}. Nothing sent.`,
          );
        }
      }
      if (this.mixpanel.hierarchical_groups && !company) {
        throw new MixpanelCompanyRequiredError(
          "Group profile updates for hierarchical groups projects require a company. " +
            "Use mixpanel.for_company(company_id) to send them. Nothing sent for group " +
            `${identifiers.$group_key}=${identifiers.$group_id}`,
        );
      }
      const target = { endpoint: "/groups", identifiers };
      if (company) {
        target.company_id = company;
      }
      return target;
    }

    /** builds the message for the target and sends it */
    _send_profile_update(
      target,
      data,
      modifiers,
      callback,
      debug_message,
      debug_data,
    ) {
      data = {
        ...data,
        $token: this.token,
        ...target.identifiers,
      };

      data = merge_modifiers(data, modifiers_or_none(modifiers));

      // $company_id must be top-level, not inside the operation payload, and
      // the resolved company wins over a $company_id modifier
      if (target.company_id) {
        data.$company_id = target.company_id;
      }

      if (this.config.debug) {
        this.mixpanel.config.logger.debug(
          debug_message ||
            `Sending the following data to Mixpanel (${target.endpoint})`,
          debug_data || { data },
        );
      }

      this.mixpanel.send_request(
        { method: "GET", endpoint: target.endpoint, data },
        callback,
      );
    }

    _set(prop, to, modifiers, callback, { identifiers, set_once = false }) {
      let $set = {};

      if (typeof prop === "object") {
        if (typeof to === "object") {
          callback = modifiers;
          modifiers = to;
        } else {
          callback = to;
        }
        $set = prop;
      } else {
        $set[prop] = to;
        if (typeof modifiers === "function" || !modifiers) {
          callback = modifiers;
        }
      }

      const target = this._target(identifiers, modifiers);

      const set_key = set_once ? "$set_once" : "$set";
      const data = {
        $token: this.token,
        ...target.identifiers,
        [set_key]: $set,
      };

      if ("ip" in $set) {
        data.$ip = $set.ip;
        delete $set.ip;
      }

      if ($set.$ignore_time) {
        data.$ignore_time = $set.$ignore_time;
        delete $set.$ignore_time;
      }

      this._send_profile_update(target, data, modifiers, callback);
    }

    _delete_profile({ identifiers, modifiers, callback }) {
      if (typeof modifiers === "function") {
        callback = modifiers;
      }

      const target = this._target(identifiers, modifiers);

      this._send_profile_update(
        target,
        { $delete: "" },
        modifiers,
        callback,
        "Deleting profile",
        { identifiers },
      );
    }

    _remove({ identifiers, data, modifiers, callback }) {
      let $remove = {};

      const target = this._target(identifiers, modifiers);

      if (typeof data !== "object" || Array.isArray(data)) {
        if (this.config.debug) {
          this.mixpanel.config.logger.error(
            "Invalid value passed to #remove - data must be an object with scalar values",
          );
        }
        return;
      }

      for (const [key, val] of Object.entries(data)) {
        if (typeof val === "string" || typeof val === "number") {
          $remove[key] = val;
        } else {
          if (this.config.debug) {
            this.mixpanel.config.logger.error(
              "Invalid argument passed to #remove - values must be scalar",
              { key, value: val },
            );
          }
          return;
        }
      }

      if (Object.keys($remove).length === 0) {
        return;
      }

      if (typeof modifiers === "function") {
        callback = modifiers;
      }

      this._send_profile_update(target, { $remove }, modifiers, callback);
    }

    _union({ identifiers, data, modifiers, callback }) {
      let $union = {};

      const target = this._target(identifiers, modifiers);

      if (typeof data !== "object" || Array.isArray(data)) {
        if (this.config.debug) {
          this.mixpanel.config.logger.error(
            "Invalid value passed to #union - data must be an object with scalar or array values",
          );
        }
        return;
      }

      for (const [key, val] of Object.entries(data)) {
        if (Array.isArray(val)) {
          const merge_values = val.filter(function (v) {
            return typeof v === "string" || typeof v === "number";
          });
          if (merge_values.length > 0) {
            $union[key] = merge_values;
          }
        } else if (typeof val === "string" || typeof val === "number") {
          $union[key] = [val];
        } else {
          if (this.config.debug) {
            this.mixpanel.config.logger.error(
              "Invalid argument passed to #union - values must be a scalar value or array",
              { key, value: val },
            );
          }
        }
      }

      if (Object.keys($union).length === 0) {
        return;
      }

      if (typeof modifiers === "function") {
        callback = modifiers;
      }

      this._send_profile_update(target, { $union }, modifiers, callback);
    }

    _unset({ identifiers, prop, modifiers, callback }) {
      let $unset = [];

      const target = this._target(identifiers, modifiers);

      if (Array.isArray(prop)) {
        $unset = prop;
      } else if (typeof prop === "string") {
        $unset = [prop];
      } else {
        if (this.config.debug) {
          this.mixpanel.config.logger.error(
            "Invalid argument passed to #unset - must be a string or array",
            { prop },
          );
        }
        return;
      }

      if (typeof modifiers === "function") {
        callback = modifiers;
      }

      this._send_profile_update(target, { $unset }, modifiers, callback);
    }
  };
