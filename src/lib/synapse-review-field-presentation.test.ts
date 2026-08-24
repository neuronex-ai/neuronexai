import { describe, expect, it } from "vitest";
import { getSynapseReviewFieldPresentation } from "./synapse-review-field-presentation";

describe("Synapse review field presentation", () => {
  it("presents appointment timestamps as a native local date and time", () => {
    const presentation = getSynapseReviewFieldPresentation(
      "datetime",
      "data e horário",
      "2026-08-25T18:00:00-03:00",
    );

    expect(presentation.inputType).toBe("datetime-local");
    expect(presentation.editValue).toBe("2026-08-25T18:00");
    expect(presentation.formatForRequest("2026-08-26T19:30")).toBe("2026-08-26T19:30:00-03:00");
  });

  it("presents due dates as native localized dates", () => {
    const presentation = getSynapseReviewFieldPresentation("due_date", "vencimento", "2026-08-19");

    expect(presentation.inputType).toBe("date");
    expect(presentation.editValue).toBe("2026-08-19");
    expect(presentation.formatForRequest("2026-08-20")).toBe("2026-08-20");
  });

  it("does not reinterpret ordinary text or numeric fields", () => {
    const presentation = getSynapseReviewFieldPresentation("amount", "valor", 229);

    expect(presentation.inputType).toBe("text");
    expect(presentation.editValue).toBe("229");
    expect(presentation.formatForRequest("230")).toBe("230");
  });
});
