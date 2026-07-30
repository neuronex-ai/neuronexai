import type { Appointment } from "@/types";

export type MaterialAppointmentFields = Pick<
  Appointment,
  "start_time" | "end_time" | "type" | "location"
>;

const MATERIAL_FIELDS = new Set<keyof MaterialAppointmentFields>([
  "start_time",
  "end_time",
  "type",
  "location",
]);

const sameInstant = (left: unknown, right: unknown) => {
  const leftTime = new Date(String(left)).getTime();
  const rightTime = new Date(String(right)).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
};

const materialFieldChanged = (
  field: keyof MaterialAppointmentFields,
  nextValue: unknown,
  currentValue: unknown,
) => {
  if (field === "start_time" || field === "end_time") return !sameInstant(nextValue, currentValue);
  if (field === "location") return String(nextValue || "").trim() !== String(currentValue || "").trim();
  return nextValue !== currentValue;
};

export const hasMaterialAppointmentChanges = (
  current: MaterialAppointmentFields,
  updates: Partial<MaterialAppointmentFields>,
) => Object.entries(updates).some(([rawField, value]) => {
  const field = rawField as keyof MaterialAppointmentFields;
  return value !== undefined
    && MATERIAL_FIELDS.has(field)
    && materialFieldChanged(field, value, current[field]);
});

