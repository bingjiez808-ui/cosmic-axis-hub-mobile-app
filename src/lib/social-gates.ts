/**
 * Social-feature gates (age, preview host).
 *
 * These are hard rules for the /me/home /me/friends /me/match preview
 * routes and the future production surface. Nothing here fetches or
 * writes; the flags are configurable via constants only.
 */
import { isGuidedLibraryV2PreviewAllowed } from "@/experiences/library-v2/preview-guard";

/**
 * Minimum age required to enter the friend/match surface.
 * Kept conservative at 18+ by product decision; only a numeric literal
 * change updates it. If a user has not confirmed age they must be
 * treated as under-18 (i.e. blocked from any pair-matching flow).
 */
export const SOCIAL_MIN_AGE = 18;

export function ageAtLeast(min: number, dobIsoDate: string | null | undefined): boolean {
  if (!dobIsoDate) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dobIsoDate);
  if (!m) return false;
  const [_, y, mo, d] = m;
  const dob = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  const now = new Date();
  const years =
    now.getUTCFullYear() -
    dob.getUTCFullYear() -
    (now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())
      ? 1
      : 0);
  return years >= min;
}

/** Reuse the V2 guard: only DEV / localhost / id-preview--*.lovable.app. */
export function isSocialPreviewAllowed(input: { hostname: string; isDev: boolean }): boolean {
  return isGuidedLibraryV2PreviewAllowed(input);
}
