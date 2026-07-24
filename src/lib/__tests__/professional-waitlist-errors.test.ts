import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getProfessionalWaitlistErrorMessage } from "../professional-waitlist-errors";

describe("professional waitlist error messages", () => {
  it("hides the missing suggestion RPC and schema-cache details", () => {
    expect(
      getProfessionalWaitlistErrorMessage(
        "Could not find the function public.suggest_professional_waitlist_slot(p_entry_id, p_search_days) in the schema cache",
      ),
    ).toBe("Estamos atualizando a busca de vagas. Tente novamente em instantes.");
  });

  it("explains a completed waitlist acceptance without exposing a database state error", () => {
    expect(
      getProfessionalWaitlistErrorMessage(
        "RPC set_professional_waitlist_entry_status failed: 55000 Appointment state does not allow this action",
      ),
    ).toBe("Não foi possível concluir essa ação com o estado atual da lista. Atualize a tela e tente novamente.");
  });

  it("keeps appointment conflicts actionable", () => {
    expect(getProfessionalWaitlistErrorMessage("23P01 slot conflict")).toBe(
      "Esse horário acabou de ser ocupado. Escolha outra vaga sugerida.",
    );
  });
});

describe("public waitlist offer response", () => {
  it("does not render raw RPC details to the patient", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/pages/public/WaitlistOfferResponse.tsx"),
      "utf8",
    );

    expect(source).toContain("getOfferResponseErrorMessage(rpcError)");
    expect(source).not.toContain("setError(rpcError.message");
  });
});
