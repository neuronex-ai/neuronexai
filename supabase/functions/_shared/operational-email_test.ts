import {
  buildOperationalEmail,
  type OperationalEmailInput,
} from "./operational-email.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNoMojibake(value: string, context: string) {
  const mojibakePatterns = [
    /\u00c3(?:[\u0080-\u00bf]|\u0192|\u201a|\u201e|\u2026|\u2020|\u2021|\u02c6|\u2030|\u0160|\u2039|\u0152|\u017d|\u2018|\u2019|\u201c|\u201d|\u2022|\u2013|\u2014|\u02dc|\u2122|\u0161|\u203a|\u0153|\u017e|\u0178)/u,
    /\u00c2[\u0080-\u00bf]/u,
    /\u00e2(?:[\u0080-\u00bf]|\u201a|\u20ac|\u2122)/u,
    /\ufffd/u,
  ];
  assert(
    mojibakePatterns.every((pattern) => !pattern.test(value)),
    `${context} must not contain mojibake`,
  );
}

const baseInput: OperationalEmailInput = {
  preheader: "Revise os detalhes e confirme com seguran\u00e7a.",
  recipientName: "Jo\u00e3o da Concei\u00e7\u00e3o",
  title: "Confirme sua consulta",
  introduction: "O hor\u00e1rio abaixo est\u00e1 reservado para voc\u00ea.",
  professionalName: "Dra. M\u00e1rcia S\u00e3o Jos\u00e9",
  appointmentDate: "quinta-feira, 16 de julho de 2026",
  appointmentTime: "07:00",
  appointmentLocation: "Consult\u00f3rio",
  actionUrl: "https://neuronex.site/confirmar-agendamento/token-seguro",
  actionLabel: "Gerenciar agendamento",
  policy: {
    deadline: "quarta-feira, 15 de julho, 18:00",
    consequence:
      "qualquer ajuste financeiro exigir\u00e1 an\u00e1lise pr\u00e9via.",
  },
  detail:
    "O link expira quando uma nova vers\u00e3o do hor\u00e1rio for enviada.",
};

Deno.test("buildOperationalEmail uses a portable premium table shell", () => {
  const { html, text } = buildOperationalEmail(baseInput);

  assert(
    html.startsWith("<!doctype html>"),
    "Expected a complete HTML document",
  );
  assert(
    html.includes('<meta charset="UTF-8">'),
    "Expected an explicit UTF-8 charset",
  );
  assert(
    html.includes('<table role="presentation" width="100%"'),
    "Expected presentation tables compatible with major email clients",
  );
  assert(
    html.includes("max-width:640px"),
    "Expected a constrained responsive letter shell",
  );
  assert(
    html.includes("display:none;max-height:0;overflow:hidden"),
    "Expected a hidden preheader",
  );
  assert(html.includes(baseInput.preheader), "Expected the supplied preheader");
  assert(
    html.includes('bgcolor="#18181b"'),
    "Expected a table-based CTA fallback",
  );
  assert(
    html.includes(`href="${baseInput.actionUrl}"`),
    "Expected the secure CTA URL",
  );
  assert(!/<script\b/iu.test(html), "Email HTML must not contain script tags");
  assert(
    !/javascript\s*:/iu.test(html),
    "Email HTML must not contain JavaScript URLs",
  );
  assert(
    text.includes("Ol\u00e1, Jo\u00e3o da Concei\u00e7\u00e3o."),
    "Expected a UTF-8 text fallback",
  );
  assert(
    text.includes(baseInput.actionUrl),
    "Text fallback must include the secure URL",
  );
  assertNoMojibake(html, "HTML email");
  assertNoMojibake(text, "Plain-text email");
});

Deno.test("buildOperationalEmail escapes untrusted copy and ignores clinical-only fields", () => {
  const inputWithPrivateFields = {
    ...baseInput,
    recipientName: "<script>alert('name')</script>",
    clinicalNotes: "SIGILO-CLINICO-NAO-ENVIAR",
    diagnosis: "DIAGNOSTICO-NAO-ENVIAR",
    sessionTranscript: "TRANSCRICAO-NAO-ENVIAR",
  } as OperationalEmailInput & Record<string, unknown>;

  const { html, text } = buildOperationalEmail(inputWithPrivateFields);

  assert(
    !html.includes("<script>"),
    "Untrusted copy must not become executable HTML",
  );
  assert(
    html.includes("&lt;script&gt;alert(&#039;name&#039;)&lt;/script&gt;"),
    "Untrusted copy must be HTML escaped",
  );
  for (
    const privateValue of [
      inputWithPrivateFields.clinicalNotes,
      inputWithPrivateFields.diagnosis,
      inputWithPrivateFields.sessionTranscript,
    ]
  ) {
    assert(
      !html.includes(String(privateValue)),
      "HTML must not expose extra clinical fields",
    );
    assert(
      !text.includes(String(privateValue)),
      "Text must not expose extra clinical fields",
    );
  }
});

Deno.test("buildOperationalEmail keeps cancellation and rescheduling deadlines distinct", () => {
  const cancellationDeadline = "quarta-feira, 15 de julho, 18:00";
  const rescheduleDeadline = "quarta-feira, 15 de julho, 12:00";
  const { html, text } = buildOperationalEmail({
    ...baseInput,
    policy: {
      cancellationDeadline,
      rescheduleDeadline,
      consequence:
        "qualquer ajuste financeiro exigir\u00e1 an\u00e1lise pr\u00e9via.",
    },
  });

  for (const output of [html, text]) {
    assert(
      output.includes(cancellationDeadline),
      "Expected the cancellation deadline",
    );
    assert(
      output.includes(rescheduleDeadline),
      "Expected the rescheduling deadline",
    );
  }
  assert(
    html.includes("Cancelamento"),
    "Expected an explicit cancellation label",
  );
  assert(
    html.includes("outro hor&aacute;rio"),
    "Expected an explicit rescheduling label",
  );
  assert(
    text.includes("Cancelamento"),
    "Plain text must label cancellation separately",
  );
  assert(
    text.includes("outro hor\u00e1rio"),
    "Plain text must label rescheduling separately",
  );
});
