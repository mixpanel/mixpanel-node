const { MixpanelArgumentError } = require("./errors");

// identity field -> the key it is sent as
const IDENTITY_KEYS = {
  distinct_id: "distinct_id",
  user_id: "$user_id",
  company_id: "$company_id",
  device_id: "$device_id",
};

// identity field -> the key a flag evaluation context reads it from
const FLAG_CONTEXT_KEYS = {
  distinct_id: "distinct_id",
  user_id: "$user_id",
  company_id: "$company_id",
  device_id: "device_id",
};

/**
 * Identifies who an event or profile update belongs to.
 *
 * Mixpanel resolves an identity from whichever of `distinct_id`, `$user_id`,
 * `$company_id` and `$device_id` an event carries, so an identity sets any
 * combination of them and leaves the rest unset (null).
 *
 * @example
 * new MixpanelIdentity({ distinct_id: "user_123" });                        // a plain distinct id
 * new MixpanelIdentity({ user_id: "user_123", device_id: "device_abc" });   // simplified id merge
 * new MixpanelIdentity({ user_id: "user_123", company_id: "acme" });        // hierarchical groups
 * new MixpanelIdentity({ device_id: "device_abc" });                        // anonymous, no user yet
 * new MixpanelIdentity({ company_id: "acme" });                             // a company, no user
 *
 * Which combinations are valid depends on the project, so the client rather
 * than this type decides. On a hierarchical groups project the company is part
 * of the user's identity: a `$user_id` sent without a `$company_id` resolves to
 * a different user that nothing reconciles later, so include the company
 * whenever the user has one. Events still send a user id without one as given;
 * user profile updates need the company. A user who belongs to two companies is
 * two users, by design.
 *
 * On a hierarchical groups project Mixpanel builds the distinct id from the
 * user and company, so a raw `distinct_id` names a different, unrelated user.
 * Set one only when it is one Mixpanel itself built, of the form
 * `$company:{company}|$user:{user}`. A user profile update rejects any other
 * distinct id on such a project.
 *
 * Instances are frozen.
 */
class MixpanelIdentity {
  /**
   * @param {object} ids
   * @param {string} [ids.distinct_id] - a distinct id Mixpanel resolves directly
   * @param {string} [ids.user_id] - the user's id; on a hierarchical groups
   *   project it only needs to be unique within the company
   * @param {string} [ids.company_id] - the id of the top-level company, on a
   *   hierarchical groups project
   * @param {string} [ids.device_id] - the client's device id
   * @throws {MixpanelArgumentError} if a value is empty or not a string, a key
   *   is unknown, or no value is set
   */
  constructor(ids) {
    if (ids === null || typeof ids !== "object" || Array.isArray(ids)) {
      throw new MixpanelArgumentError(
        "MixpanelIdentity takes an object: new MixpanelIdentity({ user_id, company_id })",
      );
    }
    for (const key of Object.keys(ids)) {
      if (!Object.prototype.hasOwnProperty.call(IDENTITY_KEYS, key)) {
        throw new MixpanelArgumentError(
          `Unknown MixpanelIdentity key "${key}". Use ${Object.keys(IDENTITY_KEYS).join(", ")}`,
        );
      }
    }
    for (const key of Object.keys(IDENTITY_KEYS)) {
      // null or undefined leaves the value unset; an empty string is a caller error
      const value = ids[key];
      if (value === undefined || value === null) {
        this[key] = null;
      } else if (typeof value !== "string") {
        throw new MixpanelArgumentError(`${key} must be a string`);
      } else if (value === "") {
        throw new MixpanelArgumentError(`${key} must be non-empty`);
      } else {
        this[key] = value;
      }
    }
    if (
      this.distinct_id === null &&
      this.user_id === null &&
      this.company_id === null &&
      this.device_id === null
    ) {
      throw new MixpanelArgumentError(
        "An identity needs at least one of distinct_id, user_id, company_id or device_id",
      );
    }
    Object.freeze(this);
  }

  /**
   * True if this identity names a company, which is what sends it down
   * Mixpanel's hierarchical groups resolution.
   * @returns {boolean}
   */
  get is_hierarchical() {
    return this.company_id !== null;
  }

  /**
   * Builds a feature flag evaluation context for this identity, so callers do
   * not hand-write reserved keys such as `$company_id`.
   *
   * @example
   * identity.to_flag_context({
   *   groups: { department: "finance" },
   *   custom_properties: { plan: "enterprise" },
   * });
   * // { $user_id: "user_123", $company_id: "acme", department: "finance",
   * //   custom_properties: { plan: "enterprise" } }
   *
   * @param {object} [options]
   * @param {object} [options.groups] - group keys and values the evaluation is
   *   for, such as `{ department: "finance" }`
   * @param {object} [options.custom_properties] - properties used by runtime
   *   targeting rules
   * @returns {object} the flag context
   */
  to_flag_context({ groups = {}, custom_properties = {} } = {}) {
    const context = { ...groups };
    for (const [key, flag_key] of Object.entries(FLAG_CONTEXT_KEYS)) {
      if (this[key] !== null) {
        context[flag_key] = this[key];
      }
    }
    if (Object.keys(custom_properties).length > 0) {
      context.custom_properties = { ...custom_properties };
    }
    return context;
  }

  toString() {
    const parts = Object.keys(IDENTITY_KEYS)
      .filter((key) => this[key] !== null)
      .map((key) => `${key}=${this[key]}`);
    return `MixpanelIdentity{${parts.join(", ")}}`;
  }
}

/**
 * The identity's keys as event properties; unset values are omitted.
 * @param {MixpanelIdentity} identity
 * @returns {object}
 */
function identity_properties(identity) {
  const properties = {};
  for (const [key, property] of Object.entries(IDENTITY_KEYS)) {
    if (identity[key] !== null) {
      properties[property] = identity[key];
    }
  }
  return properties;
}

/**
 * Hierarchical groups is a project setting, so a hierarchical identity is
 * only valid on a client created for a hierarchical groups project.
 * Ingestion accepts the keys on any project but ignores them, so a mismatch
 * would be silently mis-attributed.
 *
 * @param {MixpanelIdentity} identity
 * @param {boolean} hierarchical_groups - the client's mode
 * @throws {MixpanelArgumentError}
 */
function require_identity_matches_project(identity, hierarchical_groups) {
  if (!(identity instanceof MixpanelIdentity)) {
    throw new MixpanelArgumentError("identity must be a MixpanelIdentity");
  }
  if (identity.is_hierarchical && !hierarchical_groups) {
    throw new MixpanelArgumentError(
      `${identity} requires a hierarchical groups client: ` +
        "Mixpanel.init(token, { hierarchical_groups: true })",
    );
  }
}

const COMPANY_PREFIX = "$company:";
const USER_SEPARATOR = "|$user:";

/**
 * Splits a distinct id Mixpanel built for a hierarchical groups user,
 * `$company:{company}|$user:{user}`, into its company and user. The company
 * ends at the first `|$user:`; the user is everything after it.
 *
 * @param {*} distinct_id
 * @returns {{company_id: string, user_id: string} | null} null unless both
 *   parts are present and non-empty
 */
function parse_combined_distinct_id(distinct_id) {
  if (
    typeof distinct_id !== "string" ||
    !distinct_id.startsWith(COMPANY_PREFIX)
  ) {
    return null;
  }
  const rest = distinct_id.slice(COMPANY_PREFIX.length);
  const separator = rest.indexOf(USER_SEPARATOR);
  if (separator === -1) {
    return null;
  }
  const company_id = rest.slice(0, separator);
  const user_id = rest.slice(separator + USER_SEPARATOR.length);
  if (company_id === "" || user_id === "") {
    return null;
  }
  return { company_id, user_id };
}

module.exports = {
  MixpanelIdentity,
  identity_properties,
  parse_combined_distinct_id,
  require_identity_matches_project,
};
