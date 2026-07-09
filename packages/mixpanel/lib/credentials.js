/**
 * Service account credentials for server-to-server authentication.
 *
 * Service account authentication is the recommended method for server-side
 * integrations. It provides better security than API secrets by using
 * unique username/secret pairs instead of a single shared secret.
 *
 * @example
 * const { ServiceAccountCredentials } = require('mixpanel/lib/credentials');
 *
 * const credentials = new ServiceAccountCredentials(
 *   'your-service-account-username',
 *   'your-service-account-secret',
 *   '123456'
 * );
 * const mixpanel = Mixpanel.init('YOUR_TOKEN', { credentials });
 */
class ServiceAccountCredentials {
  /**
   * Create service account credentials.
   *
   * @param {string} username - Service account username
   * @param {string} secret - Service account secret
   * @param {string} project_id - Mixpanel project ID
   * @throws {TypeError} If any parameter is not a string, empty, or whitespace-only
   */
  constructor(username, secret, project_id) {
    if (typeof username !== "string") {
      throw new TypeError("Service account username must be a string");
    }
    if (typeof secret !== "string") {
      throw new TypeError("Service account secret must be a string");
    }
    if (typeof project_id !== "string") {
      throw new TypeError("Service account project_id must be a string");
    }

    const trimmedUsername = username.trim();
    const trimmedSecret = secret.trim();
    const trimmedProjectId = project_id.trim();

    if (!trimmedUsername) {
      throw new TypeError("Service account username cannot be empty");
    }
    if (!trimmedSecret) {
      throw new TypeError("Service account secret cannot be empty");
    }
    if (!trimmedProjectId) {
      throw new TypeError("Service account project_id cannot be empty");
    }

    this.username = trimmedUsername;
    this.secret = trimmedSecret;
    this.project_id = trimmedProjectId;

    // Cache the base64-encoded auth to avoid recomputing on every request
    this._cachedAuth = Buffer.from(this.username + ":" + this.secret).toString(
      "base64",
    );
  }

  /**
   * Convert credentials to HTTP Basic Auth format.
   *
   * @returns {string} Base64-encoded username:secret for Authorization header
   */
  toHttpBasicAuth() {
    return this._cachedAuth;
  }

  /**
   * String representation of credentials (masks secret).
   *
   * @returns {string}
   */
  toString() {
    return `ServiceAccountCredentials(username=${this.username}, project_id=${this.project_id}, secret=***)`;
  }
}

module.exports = { ServiceAccountCredentials };
