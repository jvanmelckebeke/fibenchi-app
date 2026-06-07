/**
 * Default Fibenchi endpoint, provided via the `EXPO_PUBLIC_FIBENCHI_ENDPOINT`
 * env var (set in a gitignored `.env.local`) so the host stays out of source
 * control. Empty until configured; onboarding makes it user-settable in #4.
 */
export const DEFAULT_ENDPOINT = process.env.EXPO_PUBLIC_FIBENCHI_ENDPOINT ?? '';
