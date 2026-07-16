export type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export type DeliveryResult = {
  provider: "gmail" | "resend";
  providerMessageId: string;
  gmailError: string | null;
};

export class EmailDeliveryUnavailableError extends Error {
  readonly code: "email_delivery_unavailable" | "google_reconnect_required";

  constructor(
    message: string,
    code: "email_delivery_unavailable" | "google_reconnect_required",
  ) {
    super(message);
    this.name = "EmailDeliveryUnavailableError";
    this.code = code;
  }
}

const HEADER_LINE_BREAK = /[\r\n]+/g;
const EMAIL_ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const encodeBase64Url = (value: string) =>
  encodeBase64(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const renderTemplate = (
  html: string,
  variables: Record<string, unknown>,
) =>
  Object.entries(variables)
    .reduce((result, [key, raw]) =>
      result
        .replaceAll(`{{{${key}}}}`, escapeHtml(raw))
        .replaceAll(`{{${key}}}`, escapeHtml(raw)), html);

export const sanitizeEmailHeader = (value: unknown) =>
  String(value ?? "")
    .replace(HEADER_LINE_BREAK, " ")
    .trim();

export const assertEmailAddress = (value: unknown) => {
  const address = sanitizeEmailHeader(value);
  if (!EMAIL_ADDRESS.test(address)) throw new Error("Invalid email address.");
  return address;
};

export const htmlToPlainText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/tr>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const refreshGoogleToken = async (
  db: any,
  userId: string,
  refreshToken: string,
) => {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret || !refreshToken?.trim()) {
    throw new EmailDeliveryUnavailableError(
      "Reconecte sua conta Google nas configurações para enviar pelo Gmail.",
      "google_reconnect_required",
    );
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new EmailDeliveryUnavailableError(
      "Reconecte sua conta Google nas configurações para enviar pelo Gmail.",
      "google_reconnect_required",
    );
  }
  await db.from("user_google_tokens").update({
    access_token: payload.access_token,
    expires_at: new Date(Date.now() + Number(payload.expires_in || 3600) * 1000)
      .toISOString(),
  }).eq("user_id", userId);
  return String(payload.access_token);
};

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export const hasGmailSendScope = (scope: unknown) => {
  if (typeof scope !== "string" || !scope.trim()) return true;
  return scope.split(/\s+/).includes(GMAIL_SEND_SCOPE);
};

export const googleTokenNeedsRefresh = (
  expiresAt: unknown,
  now = Date.now(),
) => {
  const expiresAtMs = new Date(String(expiresAt || "")).getTime();
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now + 60_000;
};

export const buildRawEmail = (
  senderName: string,
  senderEmail: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments: EmailAttachment[],
) => {
  const safeSenderName = sanitizeEmailHeader(senderName);
  const safeSenderEmail = assertEmailAddress(senderEmail);
  const safeRecipient = assertEmailAddress(to);
  const safeSubject = sanitizeEmailHeader(subject);
  const encodedSenderName = `=?UTF-8?B?${encodeBase64(safeSenderName)}?=`;
  const alternativeBoundary = `neuronex_alt_${crypto.randomUUID()}`;
  const alternativeParts = [
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBase64(text),
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBase64(html),
    "",
    `--${alternativeBoundary}--`,
  ];

  if (!attachments.length) {
    return [
      `To: ${safeRecipient}`,
      `From: ${encodedSenderName} <${safeSenderEmail}>`,
      `Reply-To: ${safeSenderEmail}`,
      `Subject: =?UTF-8?B?${encodeBase64(safeSubject)}?=`,
      "MIME-Version: 1.0",
      ...alternativeParts,
    ].join("\r\n");
  }

  const boundary = `neuronex_${crypto.randomUUID()}`;
  const parts = [
    `To: ${safeRecipient}`,
    `From: ${encodedSenderName} <${safeSenderEmail}>`,
    `Reply-To: ${safeSenderEmail}`,
    `Subject: =?UTF-8?B?${encodeBase64(safeSubject)}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    ...alternativeParts,
    "",
  ];

  for (const attachment of attachments) {
    const safeName = attachment.filename.replace(/[\r\n"]/g, "_");
    parts.push(
      `--${boundary}`,
      `Content-Type: ${
        attachment.contentType || "application/octet-stream"
      }; name="${safeName}"`,
      `Content-Disposition: attachment; filename="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      "",
      attachment.content,
      "",
    );
  }
  parts.push(`--${boundary}--`);
  return parts.join("\r\n");
};

const sendWithGmail = async (
  db: any,
  userId: string,
  senderName: string,
  senderEmail: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments: EmailAttachment[],
) => {
  const tokens = await db.from("user_google_tokens").select(
    "access_token,refresh_token,expires_at,scope",
  ).eq(
    "user_id",
    userId,
  ).maybeSingle();
  if (tokens.error) throw tokens.error;
  if (!tokens.data) return null;
  if (!hasGmailSendScope(tokens.data.scope)) {
    throw new EmailDeliveryUnavailableError(
      "Reconecte sua conta Google para autorizar o envio pelo Gmail.",
      "google_reconnect_required",
    );
  }

  let accessToken = String(tokens.data.access_token || "");
  const refreshToken = String(tokens.data.refresh_token || "");
  if (!accessToken || googleTokenNeedsRefresh(tokens.data.expires_at)) {
    accessToken = await refreshGoogleToken(
      db,
      userId,
      refreshToken,
    );
  }
  const raw = buildRawEmail(
    senderName,
    senderEmail,
    to,
    subject,
    html,
    text,
    attachments,
  );
  const invokeGmail = (token: string) =>
    fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodeBase64Url(raw) }),
    });

  let response = await invokeGmail(accessToken);
  // O token pode ser revogado antes de expires_at. Renove e repita uma única
  // vez; a tentativa superior continua protegida pela chave idempotente.
  if (response.status === 401) {
    accessToken = await refreshGoogleToken(db, userId, refreshToken);
    response = await invokeGmail(accessToken);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new EmailDeliveryUnavailableError(
        "Reconecte sua conta Google nas configurações para enviar pelo Gmail.",
        "google_reconnect_required",
      );
    }
    throw new Error(
      payload.error?.message || `Gmail recusou o envio: ${response.status}`,
    );
  }
  return String(payload.id || "gmail");
};

const sendWithResend = async (
  to: string,
  replyTo: string,
  subject: string,
  html: string,
  text: string,
  attachments: EmailAttachment[],
  senderProfile: "operational" | "finance" | "security" | "contact",
) => {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY n\u00e3o configurada.");
  const from = senderProfile === "finance"
    ? "NeuroFinance <financeiro@email.neuronex.site>"
    : senderProfile === "security"
    ? "NeuroNex Segurança <seguranca@email.neuronex.site>"
    : senderProfile === "contact"
    ? "Equipe NeuroNex <contato@email.neuronex.site>"
    : "NeuroNex <notificacoes@email.neuronex.site>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo,
      subject: sanitizeEmailHeader(subject),
      html,
      text,
      attachments: attachments.map(({ filename, content }) => ({
        filename,
        content,
      })),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.message || `Resend recusou o envio: ${response.status}`,
    );
  }
  return String(payload.id || "resend");
};

export const deliverPatientEmail = async (params: {
  db: any;
  userId: string;
  senderName: string;
  senderEmail: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  senderProfile?: "operational" | "finance" | "security" | "contact";
}): Promise<DeliveryResult> => {
  const attachments = params.attachments || [];
  const plainText = params.text?.trim() || htmlToPlainText(params.html);
  const recipient = assertEmailAddress(params.to);
  const senderEmail = assertEmailAddress(params.senderEmail);
  let gmailError: string | null = null;
  try {
    const gmailId = await sendWithGmail(
      params.db,
      params.userId,
      params.senderName,
      senderEmail,
      recipient,
      params.subject,
      params.html,
      plainText,
      attachments,
    );
    if (gmailId) {
      return {
        provider: "gmail",
        providerMessageId: gmailId,
        gmailError: null,
      };
    }
  } catch (error) {
    gmailError = error instanceof Error ? error.message : "Falha no Gmail";
  }

  try {
    const resendId = await sendWithResend(
      recipient,
      senderEmail,
      params.subject,
      params.html,
      plainText,
      attachments,
      params.senderProfile || "operational",
    );
    return { provider: "resend", providerMessageId: resendId, gmailError };
  } catch (resendError) {
    console.error("[email-delivery] Providers unavailable", {
      gmailError,
      resendError: resendError instanceof Error
        ? resendError.message
        : "Falha desconhecida no canal institucional",
    });
    const googleReconnectRequired = Boolean(
      gmailError?.includes("Reconecte sua conta Google"),
    );
    throw new EmailDeliveryUnavailableError(
      googleReconnectRequired
        ? "Não foi possível enviar pelo Gmail. Reconecte sua conta Google nas configurações e tente novamente."
        : "Os canais de e-mail estão temporariamente indisponíveis. Tente novamente em instantes.",
      googleReconnectRequired
        ? "google_reconnect_required"
        : "email_delivery_unavailable",
    );
  }
};
