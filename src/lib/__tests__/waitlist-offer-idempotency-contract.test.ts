import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getProfessionalWaitlistErrorMessage } from "../professional-waitlist-errors";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("waitlist offer idempotency contract", () => {
  it("uses one fresh key per intentional offer submission", () => {
    const panel = source("src/components/agenda/ProfessionalWaitlistPanel.tsx");
    const hook = source("src/hooks/use-professional-waitlist.ts");

    expect(panel).toContain("offerSubmissionKeyRef");
    expect(panel).toContain("crypto.randomUUID()");
    expect(panel).toContain("idempotencyKey,");
    expect(hook).toContain("p_idempotency_key: idempotencyKey");
    expect(hook).not.toContain("`waitlist-${entryId}-${startsAt}`");
  });

  it("keeps an active retry safe without returning the token or acceptance path", () => {
    const migration = source("supabase/migrations/20260724230635_harden_waitlist_offer_reoffers.sql");
    const idempotentStart = migration.indexOf("'idempotent', true");
    const terminalStart = migration.indexOf("'reofferRequired', true");
    const idempotentReply = migration.slice(idempotentStart, terminalStart);

    expect(idempotentStart).toBeGreaterThan(-1);
    expect(terminalStart).toBeGreaterThan(idempotentStart);
    expect(idempotentReply).toContain("'linkAvailable', false");
    expect(idempotentReply).not.toMatch(/token|responsePath/iu);
    expect(migration).toContain("'alreadyOffered', true");
    expect(migration).toMatch(/char_length\(p_idempotency_key\) not between 8 and 240/u);
  });

  it("checks an active pending offer before the active-entry matcher and restores terminal offers for reoffer", () => {
    const migration = source("supabase/migrations/20260724230635_harden_waitlist_offer_reoffers.sql");
    const pendingOfferBranch = migration.indexOf("'alreadyOffered', true");
    const restoreActiveEntry = migration.indexOf("if v_entry.status = 'offered' then");
    const matcher = migration.indexOf("v_matches := private.match_professional_waitlist_slot(");

    expect(pendingOfferBranch).toBeGreaterThan(-1);
    expect(restoreActiveEntry).toBeGreaterThan(pendingOfferBranch);
    expect(matcher).toBeGreaterThan(restoreActiveEntry);
    expect(migration).toContain("set status = 'active', updated_at = now()");
  });

  it("does not mislabel an offer key collision as a duplicate waitlist entry", () => {
    expect(
      getProfessionalWaitlistErrorMessage(
        "duplicate key value violates unique constraint appointment_slot_holds_professional_id_idempotency_key_key",
      ),
    ).toBe("Esta tentativa de oferta já foi registrada. Revise a vaga antes de oferecê-la novamente.");
  });
});
