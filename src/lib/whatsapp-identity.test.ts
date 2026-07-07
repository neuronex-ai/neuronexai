import { describe, expect, it } from "vitest";

import {
  formatRemoteJid,
  identityKeyFor,
  identityVariantsFrom,
  identitiesIntersect,
  phoneDigitsFrom,
} from "./whatsapp-identity";

describe("whatsapp identity helpers", () => {
  it("matches Brazilian mobile variants with and without country code and ninth digit", () => {
    const owner = "+55 47 98873-0611";

    expect(identitiesIntersect([owner], ["554788730611"])).toBe(true);
    expect(identitiesIntersect([owner], ["4788730611@s.whatsapp.net"])).toBe(true);
    expect(identitiesIntersect([owner], ["98873-0611"])).toBe(true);
    expect(identitiesIntersect([owner], ["8873-0611"])).toBe(true);
  });

  it("builds the same identity key for ninth-digit variants", () => {
    expect(identityKeyFor("+55 47 98873-0611")).toBe(identityKeyFor("554788730611"));
  });

  it("does not treat lid-only identifiers as phone numbers", () => {
    expect(phoneDigitsFrom("cmq642l6f02f2pk4yt50wxxtg@lid")).toBe("");
  });

  it("formats known phone numbers and hides technical ids", () => {
    expect(formatRemoteJid("5547988730611@s.whatsapp.net")).toBe("(47) 98873-0611");
    expect(formatRemoteJid("cmq642l6f02f2pk4yt50wxxtg@lid")).toBe("Número não informado");
  });

  it("includes jid and phone aliases for lookups", () => {
    const variants = identityVariantsFrom("+55 47 98873-0611");
    expect(variants).toContain("5547988730611@s.whatsapp.net");
    expect(variants).toContain("554788730611@s.whatsapp.net");
    expect(variants).toContain("88730611");
  });
});
