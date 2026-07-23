import { describe, expect, it } from "vitest";

import { getNeuroFinanceProfessionalName } from "./neurofinance-profile-name";

describe("getNeuroFinanceProfessionalName", () => {
  it("prioritizes the registered first and last name", () => {
    expect(
      getNeuroFinanceProfessionalName(
        {
          first_name: "  Joana ",
          last_name: " Gasperi  ",
          full_name: "Outro nome",
          name: null,
        },
        "Titular bancário",
      ),
    ).toBe("Joana Gasperi");
  });

  it("uses the available profile or account holder fallback without empty labels", () => {
    expect(
      getNeuroFinanceProfessionalName(
        { first_name: null, last_name: null, full_name: "  Ana Lima  ", name: null },
      ),
    ).toBe("Ana Lima");
    expect(getNeuroFinanceProfessionalName(null, "  Carlos Souza ")).toBe("Carlos Souza");
    expect(getNeuroFinanceProfessionalName()).toBe("Profissional NeuroNex");
  });
});
