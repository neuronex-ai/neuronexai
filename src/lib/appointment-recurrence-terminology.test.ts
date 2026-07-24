import { describe, expect, it } from "vitest";

import { getAppointmentRecurrenceTerminology } from "@/lib/appointment-recurrence-terminology";

describe("appointment recurrence terminology", () => {
  it("keeps clinical recurrence language tied to sessions", () => {
    expect(getAppointmentRecurrenceTerminology("session")).toMatchObject({
      heading: "Como as sessões se repetem?",
      plural: "sessões",
      firstOccurrence: "a primeira sessão",
      terminationCountLabel: "Após sessões",
    });
  });

  it("uses event language for a general commitment", () => {
    expect(getAppointmentRecurrenceTerminology("event")).toMatchObject({
      heading: "Como os eventos se repetem?",
      plural: "eventos",
      firstOccurrence: "o primeiro evento",
      terminationCountLabel: "Após eventos",
      customizeLabel: "Personalizar eventos",
    });
  });
});
