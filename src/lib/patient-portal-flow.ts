export const PATIENT_PORTAL_INVITE_TOKEN_KEY = "neuronex_patient_portal_invite_token";

const normalizeInviteToken = (token?: string | null) => String(token || "").trim();

export function readPatientPortalInviteToken() {
  if (typeof window === "undefined") return "";

  const sessionToken = normalizeInviteToken(window.sessionStorage.getItem(PATIENT_PORTAL_INVITE_TOKEN_KEY));
  if (sessionToken) return sessionToken;

  const legacyToken = normalizeInviteToken(window.localStorage.getItem(PATIENT_PORTAL_INVITE_TOKEN_KEY));
  if (legacyToken) {
    window.sessionStorage.setItem(PATIENT_PORTAL_INVITE_TOKEN_KEY, legacyToken);
    window.localStorage.removeItem(PATIENT_PORTAL_INVITE_TOKEN_KEY);
  }
  return legacyToken;
}

export function storePatientPortalInviteToken(token?: string | null) {
  const normalized = normalizeInviteToken(token);
  if (!normalized || typeof window === "undefined") return "";
  window.sessionStorage.setItem(PATIENT_PORTAL_INVITE_TOKEN_KEY, normalized);
  window.localStorage.removeItem(PATIENT_PORTAL_INVITE_TOKEN_KEY);
  return normalized;
}

export function clearPatientPortalInviteToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PATIENT_PORTAL_INVITE_TOKEN_KEY);
  window.localStorage.removeItem(PATIENT_PORTAL_INVITE_TOKEN_KEY);
}

