import { assertEquals, assertThrows } from "jsr:@std/assert@1";

import { parsePackageLifecycleRequest } from "./contract.ts";

const sourcePackageId = "6a0d854f-6e35-44c3-80bf-a5546cc53441";
const targetPackageId = "5e3d8551-2728-4f8e-b043-ccf1858a8398";
const appointmentId = "e87b705b-b737-4ab7-9bb1-cb43ca3bded7";

Deno.test("package lifecycle contract defaults to all future occurrences", () => {
  const parsed = parsePackageLifecycleRequest({
    sourcePackageId,
    targetPackageId,
    operationType: "replace",
  });
  assertEquals(parsed.scope, "all_future");
  assertEquals(parsed.financialStrategy, "keep_existing");
});

Deno.test("package lifecycle execution keeps the confirmed occurrence snapshot", () => {
  const parsed = parsePackageLifecycleRequest({
    mode: "execute",
    sourcePackageId,
    targetPackageId,
    operationType: "replace",
    scope: "all_future",
    reason: "Troca solicitada pelo profissional",
    idempotencyKey: "replace:series:123",
    expectedAppointmentIds: [appointmentId],
  });
  assertEquals(parsed.expectedAppointmentIds, [appointmentId]);
});

Deno.test("package lifecycle blocks partial end and insufficient confirmation data", () => {
  assertThrows(
    () => parsePackageLifecycleRequest({
      sourcePackageId,
      operationType: "end",
      scope: "only_this",
      anchorAppointmentId: appointmentId,
    }),
    Error,
    "todas as ocorrências futuras",
  );
  assertThrows(
    () => parsePackageLifecycleRequest({
      mode: "execute",
      sourcePackageId,
      targetPackageId,
      operationType: "replace",
      reason: "Troca",
      idempotencyKey: "replace:series:123",
    }),
    Error,
    "lista de ocorrências",
  );
});

Deno.test("package lifecycle blocks replacement by the same package", () => {
  assertThrows(
    () => parsePackageLifecycleRequest({
      sourcePackageId,
      targetPackageId: sourcePackageId,
      operationType: "replace",
    }),
    Error,
    "diferente",
  );
});
