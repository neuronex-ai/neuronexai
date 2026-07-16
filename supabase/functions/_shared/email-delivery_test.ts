import {
  assertEmailAddress,
  buildRawEmail,
  googleTokenNeedsRefresh,
  hasGmailSendScope,
} from "./email-delivery.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}\nExpected: ${String(expected)}\nActual: ${String(actual)}`,
    );
  }
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeMimePart(raw: string, mediaType: "text/plain" | "text/html") {
  const escapedMediaType = mediaType.replace("/", "\\/");
  const match = raw.match(
    new RegExp(
      `Content-Type: ${escapedMediaType}; charset=UTF-8\\r\\n` +
        "Content-Transfer-Encoding: base64\\r\\n\\r\\n([A-Za-z0-9+/=]+)",
    ),
  );
  assert(match, `Expected a base64 encoded ${mediaType} MIME part`);
  return decodeBase64(match[1]);
}

Deno.test("buildRawEmail creates a UTF-8 multipart/alternative message", () => {
  const subject = "Confirma\u00e7\u00e3o da sua sess\u00e3o";
  const plainText =
    "Ol\u00e1, Jo\u00e3o. Sua sess\u00e3o est\u00e1 confirmada.";
  const html =
    "<p>Ol\u00e1, Jo\u00e3o. Sua sess\u00e3o est\u00e1 <strong>confirmada</strong>.</p>";

  const raw = buildRawEmail(
    "Cl\u00ednica S\u00e3o Jos\u00e9",
    "clinica@example.com",
    "paciente@example.com",
    subject,
    html,
    plainText,
    [],
  );

  assert(raw.includes("MIME-Version: 1.0"), "Expected MIME version header");
  assert(
    raw.includes(
      'Content-Type: multipart/alternative; boundary="neuronex_alt_',
    ),
    "Expected a multipart/alternative container",
  );
  assert(
    raw.includes("Content-Type: text/plain; charset=UTF-8"),
    "Expected a UTF-8 plain-text part",
  );
  assert(
    raw.includes("Content-Type: text/html; charset=UTF-8"),
    "Expected a UTF-8 HTML part",
  );
  assertEquals(
    decodeMimePart(raw, "text/plain"),
    plainText,
    "The plain-text part must survive UTF-8 MIME encoding",
  );
  assertEquals(
    decodeMimePart(raw, "text/html"),
    html,
    "The HTML part must survive UTF-8 MIME encoding",
  );
  assert(
    raw.includes(`Subject: =?UTF-8?B?${encodeBase64(subject)}?=`),
    "Expected an RFC 2047 UTF-8 encoded subject",
  );
});

Deno.test("buildRawEmail prevents email-header injection", () => {
  const injectedSubject = "Confirma\u00e7\u00e3o\r\nBcc: attacker@example.com";
  const raw = buildRawEmail(
    "Profissional\r\nCc: attacker@example.com",
    "professional@example.com",
    "patient@example.com",
    injectedSubject,
    "<p>Mensagem segura</p>",
    "Mensagem segura",
    [],
  );
  const headerBlock = raw.slice(0, raw.indexOf("\r\n\r\n"));

  assert(
    !headerBlock.includes("\r\nBcc:"),
    "Subject must not create a Bcc header",
  );
  assert(
    !headerBlock.includes("\r\nCc:"),
    "Sender name must not create a Cc header",
  );
  assert(
    raw.includes(
      `Subject: =?UTF-8?B?${
        encodeBase64("Confirma\u00e7\u00e3o Bcc: attacker@example.com")
      }?=`,
    ),
    "The sanitized subject must remain RFC 2047 encoded",
  );

  let rejected = false;
  try {
    assertEmailAddress("patient@example.com\r\nBcc: attacker@example.com");
  } catch {
    rejected = true;
  }
  assert(rejected, "An address containing an injected header must be rejected");
});

Deno.test("Gmail delivery requires the send scope when Google recorded scopes", () => {
  assert(
    hasGmailSendScope(
      "openid https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send",
    ),
    "The gmail.send scope must be accepted",
  );
  assert(
    !hasGmailSendScope("openid https://www.googleapis.com/auth/calendar"),
    "A connection without gmail.send must require reconnection",
  );
  assert(
    hasGmailSendScope(null),
    "Legacy token rows without a recorded scope must remain compatible",
  );
});

Deno.test("Google tokens refresh before expiry and when expiry is invalid", () => {
  const now = new Date("2026-07-16T00:00:00.000Z").getTime();
  assert(
    googleTokenNeedsRefresh("2026-07-16T00:00:30.000Z", now),
    "A token expiring within one minute must refresh",
  );
  assert(
    !googleTokenNeedsRefresh("2026-07-16T00:10:00.000Z", now),
    "A token with enough lifetime must be reused",
  );
  assert(
    googleTokenNeedsRefresh("invalid", now),
    "An invalid expiry must never be treated as a usable token",
  );
});
