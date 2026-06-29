/**
 * Where a SelectedVariant came from. Set by the providers on every returned
 * variant. Coarse-grained (local / remote / fallback) — for the specific
 * reason behind a fallback, see FallbackReason.
 */
const VariantSource = Object.freeze({
  LOCAL: "local",
  REMOTE: "remote",
  FALLBACK: "fallback",
});

/**
 * Why the SDK returned the developer fallback. Only meaningful when
 * `variant_source === 'fallback'`.
 *
 * `kind` is the discriminator (PHP-aligned). `message` is set on the reasons
 * that carry useful detail (BACKEND_ERROR with the backend's response body,
 * MISSING_CONTEXT_KEY with the missing attribute name); null otherwise. The
 * OpenFeature wrapper dispatches on kind and forwards message into
 * ResolutionDetails.errorMessage.
 */
const FallbackReasonKind = Object.freeze({
  FLAG_NOT_FOUND: "FLAG_NOT_FOUND",
  MISSING_CONTEXT_KEY: "MISSING_CONTEXT_KEY",
  NO_ROLLOUT_MATCH: "NO_ROLLOUT_MATCH",
  BACKEND_ERROR: "BACKEND_ERROR",
  NOT_READY: "NOT_READY",
});

const FallbackReason = Object.freeze({
  flagNotFound() {
    return _FLAG_NOT_FOUND;
  },
  noRolloutMatch() {
    return _NO_ROLLOUT_MATCH;
  },
  notReady() {
    return _NOT_READY;
  },
  missingContextKey(key = null) {
    return Object.freeze({
      kind: FallbackReasonKind.MISSING_CONTEXT_KEY,
      message: key,
    });
  },
  backendError(message) {
    return Object.freeze({ kind: FallbackReasonKind.BACKEND_ERROR, message });
  },
  // Re-exported so consumers can compare via `reason.kind === FallbackReason.Kind.BACKEND_ERROR`
  Kind: FallbackReasonKind,
});

const _FLAG_NOT_FOUND = Object.freeze({
  kind: FallbackReasonKind.FLAG_NOT_FOUND,
  message: null,
});
const _NO_ROLLOUT_MATCH = Object.freeze({
  kind: FallbackReasonKind.NO_ROLLOUT_MATCH,
  message: null,
});
const _NOT_READY = Object.freeze({
  kind: FallbackReasonKind.NOT_READY,
  message: null,
});

/**
 * Return a shallow copy of `variant` tagged with `source`. Clears
 * fallback_reason — use asFallback when returning a fallback.
 */
function withSource(variant, source) {
  return Object.assign({}, variant, {
    variant_source: source,
    fallback_reason: undefined,
  });
}

/**
 * Return a shallow copy of `variant` tagged as a fallback with `reason`.
 * `reason` is a FallbackReason value object from one of the factories above.
 */
function asFallback(variant, reason) {
  return Object.assign({}, variant, {
    variant_source: VariantSource.FALLBACK,
    fallback_reason: reason,
  });
}

module.exports = { VariantSource, FallbackReason, withSource, asFallback };
