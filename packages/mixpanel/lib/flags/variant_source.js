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
 * `variant_source === 'fallback'`. Matches the constant set used by
 * mixpanel-php so the OpenFeature wrapper can map each reason to the
 * spec-correct error code instead of collapsing every fallback to
 * FLAG_NOT_FOUND.
 */
const FallbackReason = Object.freeze({
  FLAG_NOT_FOUND: "FLAG_NOT_FOUND",
  MISSING_CONTEXT_KEY: "MISSING_CONTEXT_KEY",
  NO_ROLLOUT_MATCH: "NO_ROLLOUT_MATCH",
  BACKEND_ERROR: "BACKEND_ERROR",
  NOT_READY: "NOT_READY",
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
 */
function asFallback(variant, reason) {
  return Object.assign({}, variant, {
    variant_source: VariantSource.FALLBACK,
    fallback_reason: reason,
  });
}

module.exports = { VariantSource, FallbackReason, withSource, asFallback };
