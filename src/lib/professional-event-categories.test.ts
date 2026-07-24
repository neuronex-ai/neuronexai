import { describe, expect, it } from "vitest";

import {
  getEventCategoryErrorMessage,
  normalizeEventCategoryName,
  normalizedEventCategoryKey,
} from "@/lib/professional-event-categories";

describe("professional event categories", () => {
  it("normalizes a category name before it is stored", () => {
    expect(normalizeEventCategoryName("  Reunião   de   equipe  ")).toBe("Reunião de equipe");
    expect(normalizedEventCategoryKey("REUNIÃO de equipe")).toBe("reunião de equipe");
  });

  it("converts expected database failures into actionable copy", () => {
    expect(getEventCategoryErrorMessage({ code: "23505" })).toBe(
      "Já existe uma categoria com esse nome.",
    );
    expect(getEventCategoryErrorMessage({ code: "42501" })).toContain("sessão");
    expect(getEventCategoryErrorMessage({ code: "42P01" })).toContain("preparadas");
  });
});
