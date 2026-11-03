const {
  merge_modifiers,
  ProfileHelpers,
  GROUP_OPERATIONS,
} = require("./profile_helpers");
const {
  MixpanelIdentity,
  parse_combined_distinct_id,
  require_identity_matches_project,
} = require("./identity");
const {
  MixpanelArgumentError,
  MixpanelUnsupportedOperationError,
} = require("./errors");

class MixpanelPeople extends ProfileHelpers() {
  constructor(mp_instance) {
    super();
    this.mixpanel = mp_instance;
    this.endpoint = "/engage";
  }

  /**
   * set, set_once, unset, union, remove and delete_user accept a
   * MixpanelIdentity in place of a distinct id. Without hierarchical groups, a
   * distinct id (raw or in an identity) updates that /engage profile.
   *
   * On a hierarchical groups client nothing is sent to /engage. A user's
   * profile is the group profile $group_key "$user_id" within its company,
   * sent to /groups. The user and company come from the identity's user_id
   * and company_id (else a $company_id modifier), or are parsed from a
   * distinct id of the form $company:{company}|$user:{user}. Any other
   * distinct id is rejected.
   */
  _target(identifiers, modifiers) {
    const identity = identifiers.$distinct_id;
    const hierarchical_groups = this.mixpanel.hierarchical_groups;
    if (!(identity instanceof MixpanelIdentity)) {
      if (!hierarchical_groups) {
        return { endpoint: this.endpoint, identifiers };
      }
      return this._combined_distinct_id_target(identity, modifiers);
    }
    require_identity_matches_project(identity, hierarchical_groups);
    if (identity.distinct_id !== null) {
      if (hierarchical_groups) {
        return this._combined_distinct_id_target(
          identity.distinct_id,
          modifiers,
        );
      }
      return {
        endpoint: this.endpoint,
        identifiers: { $distinct_id: identity.distinct_id },
      };
    }
    if (!hierarchical_groups) {
      throw new MixpanelArgumentError(
        `${identity} cannot identify a profile on this project. User profiles are ` +
          "addressed by distinct id unless the project uses hierarchical groups.",
      );
    }
    if (identity.user_id === null) {
      if (identity.company_id === null) {
        throw new MixpanelArgumentError(
          `${identity} names no user, so it cannot identify a profile. ` +
            "Device ids identify anonymous events, not profiles.",
        );
      }
      throw new MixpanelArgumentError(
        `User profile updates require a user id, and ${identity} has none. ` +
          "Use mixpanel.for_company(company_id).company.set(properties) to update " +
          "the company's profile.",
      );
    }
    // The identity's own company, not the client's bound company: the
    // company is part of the user's identity.
    return this._group_target(
      { $group_key: "$user_id", $group_id: identity.user_id },
      identity.company_id,
      modifiers,
    );
  }

  /**
   * The /groups user profile target for a distinct id on a hierarchical
   * groups client. Only a $company:{company}|$user:{user} distinct id names
   * a user and company; anything else is rejected before anything is sent.
   */
  _combined_distinct_id_target(distinct_id, modifiers) {
    const parsed = parse_combined_distinct_id(distinct_id);
    if (parsed === null) {
      throw new MixpanelArgumentError(
        "User profile updates on hierarchical groups projects need a user and a " +
          `company, and the distinct id ${JSON.stringify(distinct_id)} does not name both. ` +
          "Pass new MixpanelIdentity({ user_id, company_id }) or a distinct id " +
          "of the form $company:{company}|$user:{user}.",
      );
    }
    // The parsed company is part of the user's identity, so it wins over the
    // client's bound company and a $company_id modifier.
    return this._group_target(
      { $group_key: "$user_id", $group_id: parsed.user_id },
      parsed.company_id,
      modifiers,
    );
  }

  /**
   * A hierarchical groups user profile is a group profile, so it supports
   * what /groups supports. Operations outside that set, clear_charges (whose
   * $transactions only track_charge writes), and any identity argument, are
   * refused before anything is sent.
   */
  _require_supported(operation, method, distinct_id) {
    if (this.mixpanel.hierarchical_groups) {
      const unsupported =
        method === "clear_charges"
          ? "people.clear_charges"
          : !GROUP_OPERATIONS.includes(operation) && operation;
      if (unsupported) {
        throw new MixpanelUnsupportedOperationError(
          `${unsupported} is not supported for hierarchical groups projects, whose user ` +
            "profiles are group profiles keyed by $user_id. Supported operations are " +
            `${GROUP_OPERATIONS.join(", ")}, so people.increment, people.append, ` +
            "people.track_charge and people.clear_charges have no hierarchical groups " +
            "equivalent.",
        );
      }
    }
    if (distinct_id instanceof MixpanelIdentity) {
      throw new MixpanelArgumentError(
        `people.${method} does not accept a MixpanelIdentity; pass a distinct id. ` +
          "Identities are accepted by set, set_once, unset, union, remove and delete_user.",
      );
    }
  }

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
  set_once(distinct_id, prop, to, modifiers, callback) {
    const identifiers = { $distinct_id: distinct_id };
    this._set(prop, to, modifiers, callback, { identifiers, set_once: true });
  }

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

            // set, set_once, unset, union, remove and delete_user also take a
            // MixpanelIdentity in place of the distinct id. On a hierarchical
            // groups client this updates the user's profile within its company,
            // as does a distinct id of the form $company:{company}|$user:{user};
            // any other distinct id throws.
            mixpanel.people.set(
                new MixpanelIdentity({ user_id: 'joe', company_id: 'acme' }),
                { 'plan': 'premium' }
            );
    */
  set(distinct_id, prop, to, modifiers, callback) {
    const identifiers = { $distinct_id: distinct_id };
    this._set(prop, to, modifiers, callback, { identifiers });
  }

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
  increment(distinct_id, prop, by, modifiers, callback) {
    this._require_supported("$add", "increment", distinct_id);
    // TODO extract to ProfileHelpers

    const $add = {};

    if (typeof prop === "object") {
      if (typeof by === "object") {
        callback = modifiers;
        modifiers = by;
      } else {
        callback = by;
      }
      for (const [key, val] of Object.entries(prop)) {
        if (isNaN(parseFloat(val))) {
          if (this.mixpanel.config.debug) {
            this.mixpanel.config.logger.error(
              "Invalid increment value passed to mixpanel.people.increment - must be a number",
              { key, value: val },
            );
          }
        } else {
          $add[key] = val;
        }
      }
    } else {
      if (typeof by === "number" || !by) {
        by = by || 1;
        $add[prop] = by;
        if (typeof modifiers === "function") {
          callback = modifiers;
        }
      } else if (typeof by === "function") {
        callback = by;
        $add[prop] = 1;
      } else {
        callback = modifiers;
        modifiers = typeof by === "object" ? by : {};
        $add[prop] = 1;
      }
    }

    let data = {
      $add: $add,
      $token: this.mixpanel.token,
      $distinct_id: distinct_id,
    };

    data = merge_modifiers(data, modifiers);

    if (this.mixpanel.config.debug) {
      this.mixpanel.config.logger.debug(
        "Sending the following data to Mixpanel (Engage)",
        { data },
      );
    }

    this.mixpanel.send_request(
      { method: "GET", endpoint: "/engage", data: data },
      callback,
    );
  }

  /**
        people.append(distinct_id, prop, value, modifiers, callback)
        ---
        Append a value to a list-valued people analytics property.

        usage:

            // append a value to a list, creating it if needed
            mixpanel.people.append('bob', 'pages_visited', 'homepage');

            // like mixpanel.people.set(), you can append multiple properties at once:
            mixpanel.people.append('bob', {
                list1: 'bob',
                list2: 123
            });
    */
  append(distinct_id, prop, value, modifiers, callback) {
    this._require_supported("$append", "append", distinct_id);
    // TODO extract to ProfileHelpers

    const $append = {};

    if (typeof prop === "object") {
      if (typeof value === "object") {
        callback = modifiers;
        modifiers = value;
      } else {
        callback = value;
      }
      Object.keys(prop).forEach(function (key) {
        $append[key] = prop[key];
      });
    } else {
      $append[prop] = value;
      if (typeof modifiers === "function") {
        callback = modifiers;
      }
    }

    let data = {
      $append: $append,
      $token: this.mixpanel.token,
      $distinct_id: distinct_id,
    };

    data = merge_modifiers(data, modifiers);

    if (this.mixpanel.config.debug) {
      this.mixpanel.config.logger.debug(
        "Sending the following data to Mixpanel (Engage)",
        { data },
      );
    }

    this.mixpanel.send_request(
      { method: "GET", endpoint: "/engage", data: data },
      callback,
    );
  }

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
  track_charge(distinct_id, amount, properties, modifiers, callback) {
    // track_charge writes $append to $transactions
    this._require_supported("$append", "track_charge", distinct_id);
    if (typeof properties === "function" || !properties) {
      callback = properties || undefined;
      properties = {};
    } else {
      if (typeof modifiers === "function" || !modifiers) {
        callback = modifiers || undefined;
        if (properties.$ignore_time || properties.hasOwnProperty("$ip")) {
          modifiers = {};
          Object.keys(properties).forEach(function (key) {
            modifiers[key] = properties[key];
            delete properties[key];
          });
        }
      }
    }

    if (typeof amount !== "number") {
      amount = parseFloat(amount);
      if (isNaN(amount)) {
        this.mixpanel.config.logger.error(
          "Invalid value passed to mixpanel.people.track_charge - must be a number",
        );
        return;
      }
    }

    properties.$amount = amount;

    if (properties.hasOwnProperty("$time")) {
      const time = properties.$time;
      if (Object.prototype.toString.call(time) === "[object Date]") {
        properties.$time = time.toISOString();
      }
    }

    let data = {
      $append: { $transactions: properties },
      $token: this.mixpanel.token,
      $distinct_id: distinct_id,
    };

    data = merge_modifiers(data, modifiers);

    if (this.mixpanel.config.debug) {
      this.mixpanel.config.logger.debug(
        "Sending the following data to Mixpanel (Engage)",
        { data },
      );
    }

    this.mixpanel.send_request(
      { method: "GET", endpoint: "/engage", data: data },
      callback,
    );
  }

  /**
        people.clear_charges(distinct_id, modifiers, callback)
        ---
        Clear all the current user's transactions.

        usage:

            mixpanel.people.clear_charges('bob');
    */
  clear_charges(distinct_id, modifiers, callback) {
    this._require_supported("$set", "clear_charges", distinct_id);
    let data = {
      $set: { $transactions: [] },
      $token: this.mixpanel.token,
      $distinct_id: distinct_id,
    };

    if (typeof modifiers === "function") {
      callback = modifiers;
    }

    data = merge_modifiers(data, modifiers);

    if (this.mixpanel.config.debug) {
      this.mixpanel.config.logger.debug("Clearing this user's charges", {
        $distinct_id: distinct_id,
      });
    }

    this.mixpanel.send_request(
      { method: "GET", endpoint: "/engage", data: data },
      callback,
    );
  }

  /**
        people.delete_user(distinct_id, modifiers, callback)
        ---
        delete an user record in engage

        usage:

            mixpanel.people.delete_user('bob');
    */
  delete_user(distinct_id, modifiers, callback) {
    const identifiers = { $distinct_id: distinct_id };
    this._delete_profile({ identifiers, modifiers, callback });
  }

  /**
        people.remove(distinct_id, data, modifiers, callback)
        ---
        remove a value from a list-valued user profile property.

        usage:

            mixpanel.people.remove('bob', {'browsers': 'firefox'});

            mixpanel.people.remove('bob', {'browsers': 'chrome', 'os': 'linux'});
    */
  remove(distinct_id, data, modifiers, callback) {
    const identifiers = { $distinct_id: distinct_id };
    this._remove({ identifiers, data, modifiers, callback });
  }

  /**
        people.union(distinct_id, data, modifiers, callback)
        ---
        merge value(s) into a list-valued people analytics property.

        usage:

            mixpanel.people.union('bob', {'browsers': 'firefox'});

            mixpanel.people.union('bob', {'browsers': ['chrome'], os: ['linux']});
    */
  union(distinct_id, data, modifiers, callback) {
    const identifiers = { $distinct_id: distinct_id };
    this._union({ identifiers, data, modifiers, callback });
  }

  /**
        people.unset(distinct_id, prop, modifiers, callback)
        ---
        delete a property on an user record in engage

        usage:

            mixpanel.people.unset('bob', 'page_views');

            mixpanel.people.unset('bob', ['page_views', 'last_login']);
    */
  unset(distinct_id, prop, modifiers, callback) {
    const identifiers = { $distinct_id: distinct_id };
    this._unset({ identifiers, prop, modifiers, callback });
  }
}

exports.MixpanelPeople = MixpanelPeople;
