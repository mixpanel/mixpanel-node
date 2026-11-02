/**
 * Errors thrown for caller mistakes, as opposed to request failures, which
 * are passed to callbacks. Each has a stable `code` to match on.
 */

/**
 * An argument the caller passed cannot be used, for example an empty id or
 * an identity this client cannot send.
 */
class MixpanelArgumentError extends TypeError {
  constructor(message) {
    super(message);
    this.name = "MixpanelArgumentError";
    this.code = "MIXPANEL_INVALID_ARGUMENT";
  }
}

/**
 * The operation has no equivalent for this project, for example
 * `people.increment` on a hierarchical groups client.
 */
class MixpanelUnsupportedOperationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MixpanelUnsupportedOperationError";
    this.code = "MIXPANEL_UNSUPPORTED_OPERATION";
  }
}

/**
 * A group profile update on a hierarchical groups client does not know which
 * company it belongs to. Send it from `mixpanel.for_company(company_id)`.
 */
class MixpanelCompanyRequiredError extends Error {
  constructor(message) {
    super(message);
    this.name = "MixpanelCompanyRequiredError";
    this.code = "MIXPANEL_COMPANY_REQUIRED";
  }
}

module.exports = {
  MixpanelArgumentError,
  MixpanelUnsupportedOperationError,
  MixpanelCompanyRequiredError,
};
