import type { AppointmentEventType } from "@/lib/appointment-form-flow";

export interface AppointmentRecurrenceTerminology {
  singular: "sessão" | "evento";
  plural: "sessões" | "eventos";
  firstSingular: "primeira sessão" | "primeiro evento";
  customizeLabel: "Personalizar sessões" | "Personalizar eventos";
  heading: "Como as sessões se repetem?" | "Como os eventos se repetem?";
  inheritanceDescription:
    | "Campos não personalizados herdam a primeira sessão."
    | "Campos não personalizados herdam o primeiro evento.";
  distributionDescription: "N sessões até uma data" | "N eventos até uma data";
  terminationCountLabel: "Após sessões" | "Após eventos";
}

export const getAppointmentRecurrenceTerminology = (
  eventType: AppointmentEventType,
): AppointmentRecurrenceTerminology => {
  if (eventType === "event") {
    return {
      singular: "evento",
      plural: "eventos",
      firstSingular: "primeiro evento",
      customizeLabel: "Personalizar eventos",
      heading: "Como os eventos se repetem?",
      inheritanceDescription: "Campos não personalizados herdam o primeiro evento.",
      distributionDescription: "N eventos até uma data",
      terminationCountLabel: "Após eventos",
    };
  }

  return {
    singular: "sessão",
    plural: "sessões",
    firstSingular: "primeira sessão",
    customizeLabel: "Personalizar sessões",
    heading: "Como as sessões se repetem?",
    inheritanceDescription: "Campos não personalizados herdam a primeira sessão.",
    distributionDescription: "N sessões até uma data",
    terminationCountLabel: "Após sessões",
  };
};
