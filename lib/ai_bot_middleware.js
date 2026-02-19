// lib/ai_bot_middleware.js

const { classify_user_agent, create_classifier } = require('./ai_bot_classifier');

/**
 * Enable AI bot classification on a Mixpanel client instance.
 * Wraps track() to auto-classify when $user_agent property is present.
 *
 * @param {Object} mixpanel - Mixpanel client from Mixpanel.init()
 * @param {Object} [options]
 * @param {string} [options.user_agent_property='$user_agent'] - Property name containing the UA string
 * @param {string} [options.property_prefix='$'] - Prefix for classification properties
 * @param {Array}  [options.additional_bots] - Additional bot patterns
 * @returns {Object} Controller with enable()/disable() methods
 */
function enable_bot_classification(mixpanel, options) {
  const opts = options || {};
  const uaProp = opts.user_agent_property || '$user_agent';
  const prefix = opts.property_prefix || '$';
  const classify = opts.additional_bots
    ? create_classifier({ additional_bots: opts.additional_bots })
    : classify_user_agent;

  let enabled = true;

  // Wrap send_event_request — the single chokepoint for all event data
  const originalSendEvent = mixpanel.send_event_request;
  mixpanel.send_event_request = function(endpoint, event, properties, callback) {
    var enrichedProperties = properties;
    if (enabled && properties && properties[uaProp]) {
      const classification = classify(properties[uaProp]);
      // Map classification properties with the configured prefix
      if (prefix === '$') {
        enrichedProperties = Object.assign({}, properties, classification);
      } else {
        enrichedProperties = Object.assign({}, properties);
        for (const [key, value] of Object.entries(classification)) {
          // $is_ai_bot -> {prefix}is_ai_bot; $ai_bot_name -> {prefix}name
          const newKey = key.startsWith('$ai_bot_')
            ? prefix + key.substring('$ai_bot_'.length)
            : prefix + key.substring(1);
          enrichedProperties[newKey] = value;
        }
      }
    }
    originalSendEvent.call(mixpanel, endpoint, event, enrichedProperties, callback);
  };

  return {
    enable: function() { enabled = true; },
    disable: function() { enabled = false; },
  };
}

/**
 * Helper: Track an event with automatic user-agent and IP extraction from an HTTP request.
 *
 * @param {Object} mixpanel - Mixpanel client
 * @param {Object} req - Node.js HTTP IncomingMessage (or Express Request)
 * @param {string} eventName - Event name
 * @param {Object} [properties] - Additional properties
 * @param {Function} [callback] - Callback
 */
function track_request(mixpanel, req, eventName, properties, callback) {
  properties = properties || {};
  const ua = req.headers && req.headers['user-agent'];
  if (ua) {
    properties.$user_agent = ua;
  }
  const ip = req.ip || (req.headers && req.headers['x-forwarded-for']) || (req.connection && req.connection.remoteAddress);
  if (ip) {
    properties.ip = ip;
  }
  mixpanel.track(eventName, properties, callback);
}

module.exports = { enable_bot_classification, track_request };
