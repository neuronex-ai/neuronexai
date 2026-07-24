import type { AppointmentEventType } from "@/lib/appointment-form-flow";

export interface AppointmentRecurrenceTerminology {
  singular: "sessão" | "evento";
  plural: "sessões" | "eventos";
  firstOccurrence: "a primeira sessão" | "o primeiro evento";
  heading: "Como as sessões se repetem?" | "Como os eventos se repetem?";
  inheritanceDescription:
    | "Campos não personalizados herdam a primeira sessão."
    | "Campos não personalizados herdam o primeiro evento.";
  distributionDescription: "N sessões até uma data" | "N eventos até uma data";
  terminationCountLabel: "Após sessões" | "Após eventos";
  customizeLabel: "Personalizar sessões" | "Personalizar eventos";
  singleLabel: "Sessão única" | "Evento único";
}

export const getAppointmentRecurrenceTerminology = (
  eventType: AppointmentEventType,
): AppointmentRecurrenceTerminology => {
  if (eventType === "event") {
    return {
      singular: "evento",
      plural: "eventos",
      firstOccurrence: "o primeiro evento",
      heading: "Como os eventos se repetem?",
      inheritanceDescription: "Campos não personalizados herdam o primeiro evento.",
      distributionDescription: "N eventos até uma data",
      terminationCountLabel: "Após eventos",
      customizeLabel: "Personalizar eventos",
      singleLabel: "Evento único",
    };
  }

  return {
    singular: "sessão",
    plural: "sessões",
    firstOccurrence: "a primeira sessão",
    heading: "Como as sessões se repetem?",
    inheritanceDescription: "Campos não personalizados herdam a primeira sessão.",
    distributionDescription: "N sessões até uma data",
    terminationCountLabel: "Após sessões",
    customizeLabel: "Personalizar sessões",
    singleLabel: "Sessão única",
  };
};
