import { describe, expect, it } from "vitest";

import { hasExplicitFinancialIntent } from "../financial-appointment-automation";

describe("appointment financial automation intent", () => {
  it("treats an explicit none mode as authoritative", () => {
    expect(hasExplicitFinancialIntent({
      metadata: { financial: { mode: "none" } },
    } as never)).toBe(true);
  });

  it("keeps legacy appointments without a financial decision eligible", () => {
    expect(hasExplicitFinancialIntent({ metadata: {} } as never)).toBe(false);
  });

  it("recognizes package and positive manual values", () => {
    expect(hasExplicitFinancialIntent({
      metadata: { financial: { mode: "package", usePackage: true } },
    } as never)).toBe(true);
    expect(hasExplicitFinancialIntent({
      metadata: { financial: { transactionAmount: 150 } },
    } as never)).toBe(true);
  });
});
