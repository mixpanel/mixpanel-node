/**
 * Base Feature Flags Provider
 * Contains common methods for feature flag evaluation
 */

const https = require('https');
const packageInfo = require('../../package.json');
const { prepareCommonQueryParams, generateTraceparent, REQUEST_HEADERS } = require('./utils');

class FeatureFlagsProvider {
    /**
     * @param {Object} providerConfig - Configuration object with token, api_host, request_timeout_in_seconds
     * @param {string} endpoint - API endpoint path (e.g., '/flags' or '/flags/definitions')
     * @param {Function} tracker - Function to track events (signature: track(distinct_id, event, properties, callback))
     * @param {CustomLogger} logger - Logger instance
     */
    constructor(providerConfig, endpoint, tracker, logger) {
        this.providerConfig = providerConfig;
        this.endpoint = endpoint;
        this.tracker = tracker;
        this.logger = logger;
    }

    /**
     * Common HTTP request handler for flags API endpoints
     * @param {Object} additionalParams - Additional query parameters to append
     * @returns {Promise<Object>} - Parsed JSON response
     */
    async callFlagsEndpoint(additionalParams = null) {
        return new Promise((resolve, reject) => {
            const commonParams = prepareCommonQueryParams(this.providerConfig.token, packageInfo.version);
            const params = new URLSearchParams(commonParams);

            if (additionalParams) {
                for (const [key, value] of Object.entries(additionalParams)) {
                    params.append(key, value);
                }
            }

            const path = `${this.endpoint}?${params.toString()}`;

            const requestOptions = {
                host: this.providerConfig.api_host,
                port: 443,
                path: path,
                method: 'GET',
                headers: {
                    ...REQUEST_HEADERS,
                    'Authorization': 'Basic ' + Buffer.from(this.providerConfig.token + ':').toString('base64'),
                    'traceparent': generateTraceparent(),
                },
                timeout: this.providerConfig.request_timeout_in_seconds * 1000,
            };

            const request = https.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        this.logger?.error(`HTTP ${res.statusCode} error calling flags endpoint: ${data}`);
                        return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }

                    try {
                        const result = JSON.parse(data);
                        resolve(result);
                    } catch (parseErr) {
                        this.logger?.error(`Failed to parse JSON response: ${parseErr.message}`);
                        reject(parseErr);
                    }
                });
            });

            request.on('error', (err) => {
                this.logger?.error(`Network error calling flags endpoint: ${err.message}`);
                reject(err);
            });

            request.on('timeout', () => {
                this.logger?.error(`Request timeout calling flags endpoint`);
                request.destroy();
                reject(new Error('Request timeout'));
            });

            request.end();
        });
    }
}

module.exports = FeatureFlagsProvider;
