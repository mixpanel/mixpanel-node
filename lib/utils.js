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
