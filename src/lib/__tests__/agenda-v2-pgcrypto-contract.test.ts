import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260723210507_fix_agenda_v2_pgcrypto_search_path.sql",
  ),
  "utf8",
);

describe("Agenda v2 pgcrypto contract", () => {
  it("keeps the action-plan functions restricted while exposing pgcrypto", () => {
    expect(migration).toContain(
      "alter function public.prepare_agenda_action_plan(text, jsonb, jsonb, text)",
    );
    expect(migration).toContain(
      "alter function private.prepare_appointment_action_plan_core(",
    );
    expect(migration).toContain(
      "alter function private.build_appointment_action_plan_snapshot(",
    );
    expect(migration.match(/set search_path = pg_catalog, extensions;/g)).toHaveLength(7);
  });
});
