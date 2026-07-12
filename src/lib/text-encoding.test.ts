import { describe, expect, it } from "vitest";

import { repairMojibake, repairTextEncodingDeep } from "./text-encoding";

describe("text encoding repair", () => {
  it("repairs common UTF-8 mojibake without touching correct Portuguese", () => {
    expect(repairMojibake("DescriÃ§Ã£o da sessÃ£o â€” revisÃ£o")).toBe(
      "Descrição da sessão — revisão",
    );
    expect(repairMojibake("Formulação clínica e São Paulo")).toBe(
      "Formulação clínica e São Paulo",
    );
  });

  it("repairs nested workflow labels and metadata", () => {
    expect(
      repairTextEncodingDeep({
        title: "HipÃ³tese clÃ­nica",
        nodes: [{ data: { label: "InÃ­cio da sessÃ£o" } }],
      }),
    ).toEqual({
      title: "Hipótese clínica",
      nodes: [{ data: { label: "Início da sessão" } }],
    });
  });
});
