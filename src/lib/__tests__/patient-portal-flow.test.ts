import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PATIENT_PORTAL_INVITE_TOKEN_KEY,
  clearPatientPortalInviteToken,
  readPatientPortalInviteToken,
  storePatientPortalInviteToken,
} from "../patient-portal-flow";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}

describe("patient portal invite token flow", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      sessionStorage: createStorage(),
      localStorage: createStorage(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the invite token in sessionStorage", () => {
    const token = storePatientPortalInviteToken(" invite-token ");

    expect(token).toBe("invite-token");
    expect(window.sessionStorage.getItem(PATIENT_PORTAL_INVITE_TOKEN_KEY)).toBe("invite-token");
    expect(window.localStorage.getItem(PATIENT_PORTAL_INVITE_TOKEN_KEY)).toBeNull();
  });

  it("migrates a legacy localStorage token into sessionStorage", () => {
    window.localStorage.setItem(PATIENT_PORTAL_INVITE_TOKEN_KEY, "legacy-token");

    expect(readPatientPortalInviteToken()).toBe("legacy-token");
    expect(window.sessionStorage.getItem(PATIENT_PORTAL_INVITE_TOKEN_KEY)).toBe("legacy-token");
    expect(window.localStorage.getItem(PATIENT_PORTAL_INVITE_TOKEN_KEY)).toBeNull();
  });

  it("clears both current and legacy token storage", () => {
    window.sessionStorage.setItem(PATIENT_PORTAL_INVITE_TOKEN_KEY, "current-token");
    window.localStorage.setItem(PATIENT_PORTAL_INVITE_TOKEN_KEY, "legacy-token");

    clearPatientPortalInviteToken();

    expect(window.sessionStorage.getItem(PATIENT_PORTAL_INVITE_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(PATIENT_PORTAL_INVITE_TOKEN_KEY)).toBeNull();
  });
});
