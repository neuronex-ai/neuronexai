import { escapeHtml } from "./email-delivery.ts";

export type OperationalEmailPolicy = {
  /** Kept for templates where both actions share the same deadline. */
  deadline?: string;
  cancellationDeadline?: string;
  rescheduleDeadline?: string;
  consequence: string;
};

export type OperationalEmailInput = {
  preheader: string;
  recipientName: string;
  title: string;
  introduction: string;
  professionalName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  actionUrl: string;
  actionLabel: string;
  policy?: OperationalEmailPolicy | null;
  detail?: string | null;
};

const safe = (value: unknown) => escapeHtml(value);

export function buildOperationalEmail(input: OperationalEmailInput) {
  const cancellationDeadline = input.policy?.cancellationDeadline ||
    input.policy?.deadline;
  const rescheduleDeadline = input.policy?.rescheduleDeadline ||
    input.policy?.deadline;
  const sharedDeadline =
    cancellationDeadline && cancellationDeadline === rescheduleDeadline
      ? cancellationDeadline
      : null;
  const deadlineHtml = sharedDeadline
    ? `Voc&ecirc; pode cancelar ou solicitar outro hor&aacute;rio sem perda do cr&eacute;dito at&eacute; <strong>${
      safe(sharedDeadline)
    }</strong>.`
    : [
      cancellationDeadline
        ? `Cancelamento sem perda autom&aacute;tica do cr&eacute;dito at&eacute; <strong>${
          safe(cancellationDeadline)
        }</strong>.`
        : null,
      rescheduleDeadline
        ? `Solicita&ccedil;&atilde;o de outro hor&aacute;rio com direito preservado at&eacute; <strong>${
          safe(rescheduleDeadline)
        }</strong>.`
        : null,
    ].filter(Boolean).join("<br>");
  const policyHtml = input.policy
    ? `<tr><td style="padding:18px 34px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-left:4px solid #18181b;background:#f4f4f5;border-radius:12px"><tr><td style="padding:17px 18px 7px;font:700 12px/1.4 Arial,sans-serif">Sua janela de escolha</td></tr><tr><td style="padding:0 18px 7px;font:400 14px/1.6 Arial,sans-serif;color:#3f3f46">${deadlineHtml}</td></tr><tr><td style="padding:0 18px 17px;font:400 13px/1.6 Arial,sans-serif;color:#52525b">Depois do prazo correspondente: ${
      safe(input.policy.consequence)
    }</td></tr></table></td></tr>`
    : "";
  const detailHtml = input.detail
    ? `<tr><td style="padding:18px 34px 0"><p style="margin:0;padding:14px 16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;font:400 14px/1.6 Arial,sans-serif;color:#3f3f46">${
      safe(input.detail)
    }</p></td></tr>`
    : "";

  const html =
    `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${
      safe(input.title)
    }</title></head><body style="margin:0;padding:0;background:#f4f4f5;color:#18181b"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${
      safe(input.preheader)
    }</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f4f5"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#fff;border:1px solid #e4e4e7;border-radius:24px"><tr><td style="padding:30px 34px;background:#09090b;border-radius:24px 24px 0 0;color:#fff"><p style="margin:0;font:700 12px/1.4 Arial,sans-serif;letter-spacing:3px">NEURONEX</p><p style="margin:10px 0 0;font:400 13px/1.5 Arial,sans-serif;color:#d4d4d8">Atendimento privado</p></td></tr><tr><td style="padding:38px 34px 18px"><p style="margin:0 0 14px;font:400 15px/1.6 Arial,sans-serif;color:#52525b">Ol&aacute;, ${
      safe(input.recipientName)
    }.</p><h1 style="margin:0 0 16px;font:700 30px/1.18 Arial,sans-serif;letter-spacing:-.5px;color:#18181b">${
      safe(input.title)
    }</h1><p style="margin:0;font:400 16px/1.7 Arial,sans-serif;color:#3f3f46">${
      safe(input.introduction)
    }</p></td></tr><tr><td style="padding:8px 34px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#fafafa;border:1px solid #e4e4e7;border-radius:18px"><tr><td style="padding:22px 22px 8px;font:700 11px/1.4 Arial,sans-serif;letter-spacing:1.6px;color:#71717a">DETALHES DO ATENDIMENTO</td></tr><tr><td style="padding:0 22px 6px;font:400 14px/1.6 Arial,sans-serif"><strong>Profissional:</strong> ${
      safe(input.professionalName)
    }</td></tr><tr><td style="padding:0 22px 6px;font:400 14px/1.6 Arial,sans-serif"><strong>Data:</strong> ${
      safe(input.appointmentDate)
    }</td></tr><tr><td style="padding:0 22px 6px;font:400 14px/1.6 Arial,sans-serif"><strong>Hor&aacute;rio:</strong> ${
      safe(input.appointmentTime)
    }</td></tr><tr><td style="padding:0 22px 22px;font:400 14px/1.6 Arial,sans-serif"><strong>Modalidade/local:</strong> ${
      safe(input.appointmentLocation)
    }</td></tr></table></td></tr>${policyHtml}${detailHtml}<tr><td style="padding:28px 34px 38px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#18181b" style="border-radius:12px"><a href="${
      safe(input.actionUrl)
    }" style="display:inline-block;padding:15px 24px;font:700 15px/1 Arial,sans-serif;color:#fff;text-decoration:none;border-radius:12px">${
      safe(input.actionLabel)
    }</a></td></tr></table><p style="margin:18px 0 0;font:400 12px/1.6 Arial,sans-serif;color:#71717a">Se o bot&atilde;o n&atilde;o abrir, copie este endere&ccedil;o: ${
      safe(input.actionUrl)
    }</p></td></tr><tr><td style="padding:22px 34px;background:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 24px 24px"><p style="margin:0 0 7px;font:700 11px/1.5 Arial,sans-serif;color:#3f3f46">SEGURAN&Ccedil;A</p><p style="margin:0;font:400 11px/1.6 Arial,sans-serif;color:#71717a">Este link &eacute; pessoal. N&atilde;o o encaminhe. A NeuroNex nunca solicitar&aacute; senha ou dados cl&iacute;nicos por e-mail.</p></td></tr></table></td></tr></table></body></html>`;

  const deadlineText = sharedDeadline
    ? `Voc\u00ea pode cancelar ou solicitar outro hor\u00e1rio sem perda do cr\u00e9dito at\u00e9 ${sharedDeadline}.`
    : [
      cancellationDeadline
        ? `Cancelamento sem perda autom\u00e1tica do cr\u00e9dito at\u00e9 ${cancellationDeadline}.`
        : null,
      rescheduleDeadline
        ? `Solicita\u00e7\u00e3o de outro hor\u00e1rio com direito preservado at\u00e9 ${rescheduleDeadline}.`
        : null,
    ].filter(Boolean).join("\n");
  const policyText = input.policy
    ? `\n\n${deadlineText}\nDepois do prazo correspondente: ${input.policy.consequence}`
    : "";
  const detailText = input.detail ? `\n\n${input.detail}` : "";
  const text =
    `Ol\u00e1, ${input.recipientName}.\n\n${input.title}\n\n${input.introduction}\n\nProfissional: ${input.professionalName}\nData: ${input.appointmentDate}\nHor\u00e1rio: ${input.appointmentTime}\nModalidade/local: ${input.appointmentLocation}${policyText}${detailText}\n\n${input.actionLabel}: ${input.actionUrl}\n\nEste link \u00e9 pessoal. N\u00e3o o encaminhe. A NeuroNex nunca solicitar\u00e1 senha ou dados cl\u00ednicos por e-mail.`;

  return { html, text };
}

export function humanPolicyConsequence(value: unknown) {
  switch (String(value || "")) {
    case "consume_credit":
      return "a sess\u00e3o poder\u00e1 consumir um cr\u00e9dito, sempre com registro e revis\u00e3o das condi\u00e7\u00f5es aplic\u00e1veis.";
    case "keep_charge":
      return "uma cobran\u00e7a prevista poder\u00e1 ser mantida, conforme as condi\u00e7\u00f5es congeladas desta consulta.";
    case "partial_fee":
      return "uma taxa parcial poder\u00e1 ser analisada antes de qualquer lan\u00e7amento.";
    case "waive":
      return "n\u00e3o haver\u00e1 penalidade autom\u00e1tica.";
    default:
      return "qualquer consequ\u00eancia financeira exigir\u00e1 an\u00e1lise; nada ser\u00e1 debitado silenciosamente.";
  }
}

export function humanDeadline(
  value: string | null | undefined,
  timeZone = "America/Sao_Paulo",
) {
  if (!value) return "o prazo informado na p\u00e1gina segura";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "o prazo informado na p\u00e1gina segura";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
