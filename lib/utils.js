/**
 * helper to wait for all callbacks to complete; similar to `Promise.all`
 * exposed to metrics object for unit tests
 * @param {Array} requests
 * @param {Function} handler
 * @param {Function} callback
 */
exports.async_all = function(requests, handler, callback) {
    var total = requests.length,
        errors = null,
        results = [],
        done = function (err, result) {
            if (err) {
                // errors are `null` unless there is an error, which allows for promisification
                errors = errors || [];
                errors.push(err);
            }
            results.push(result);
            if (--total === 0) {
                callback(errors, results)
            }
        };

    if (total === 0) {
        callback(errors, results);
    } else {
        for(var i = 0, l = requests.length; i < l; i++) {
            handler(requests[i], done);
        }
    }
};

/**
 * Validate type of time property, and convert to Unix timestamp if necessary
 * @param {Date|number} time - value to check
 * @returns {number} Unix timestamp
 */
exports.ensure_timestamp = function(time) {
    if (!(time instanceof Date || typeof time === "number")) {
        throw new Error("`time` property must be a Date or Unix timestamp and is only required for `import` endpoint");
    }
    return time instanceof Date ? time.getTime() : time;
};

/**
* Asserts that the provided logger object is valid
* @param {CustomLogger} logger - The logger object to be validated
* @throws {TypeError} If the logger object is not a valid Logger object or
*   if it is missing any of the required methods
*/
exports.assert_logger = function(logger) {
    if (typeof logger !== 'object') {
        throw new TypeError(`"logger" must be a valid Logger object`);
    }
    
    ['trace', 'debug', 'info', 'warn', 'error'].forEach((method) => {
        if (typeof logger[method] !== 'function') {
            throw new TypeError(`Logger object missing "${method}" method`);
        }
    });
};
