import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260716045239_include_uncovered_neurofinance_credits.sql",
  "utf8",
).toLowerCase();

describe("NeuroFinance overview credit contract", () => {
  it("inclui créditos reais e exclui o movimento já coberto pela cobrança", () => {
    expect(migration).toContain("m.direction = 'credit'");
    expect(migration).toContain("m.status = 'posted'");
    expect(migration).toContain("not exists");
    expect(migration).toContain("p.provider_payment_id = m.reference_id");
    expect(migration).toContain("received_total := received_total + uncovered_credit_total");
  });

  it("expõe ao frontend somente um DTO autenticado e vinculado ao usuário atual", () => {
    const returnedDto = migration.match(/returns table\s*\(([^]*?)\)\s*language sql/)?.[1] || "";

    expect(migration).toContain("create or replace function public.get_neurofinance_overview_items");
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("revoke all on public.neurofinance_overview_items_v from authenticated");
    expect(migration).toContain("grant execute on function public.get_neurofinance_overview_items");
    expect(migration).toContain(
      "revoke all on function public.refresh_neurofinance_overview_snapshot(uuid) from authenticated",
    );
    expect(returnedDto).not.toContain("metadata");
    expect(returnedDto).not.toContain("provider_payment_id");
    expect(returnedDto).not.toContain("reference_id");
  });
});
