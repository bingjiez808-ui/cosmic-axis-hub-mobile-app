/**
 * Cache-versioning for AI-generated chart artefacts.
 *
 * Bump the `_REV` string whenever the model or the prompt/schema for a
 * given generator changes. All persisted / session caches embed the
 * version string in their key AND stamp the stored payload with the
 * version, so:
 *   - session-storage entries under the old key are simply ignored
 *     (a new key is used going forward).
 *   - saved-reading entries carry `aiReportVersion` / `aiOutlookVersion`
 *     and are treated as "missing" when the version no longer matches,
 *     triggering a regeneration on next open.
 *
 * Keep the strings short — they end up in localStorage keys.
 */

// Bump when: report model changes, per-dimension prompt/schema changes,
// summary prompt changes, or the ReportAI shape changes.
export const REPORT_AI_VERSION = "r2026-07-16.gemini-3.5-flash";

// Bump when: outlook model changes, prompt/schema changes, or the
// OutlookAI shape (timeline / outlook90 / watchlist) changes.
export const OUTLOOK_AI_VERSION = "o2026-07-16.gemini-3.5-flash";
