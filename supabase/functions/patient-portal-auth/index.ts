import {
  corsResponse,
  errorResponse,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import { deliverPatientEmail, escapeHtml } from "../_shared/email-delivery.ts";
import { appBaseUrl, auditPortal, hmacHex } from "../_shared/patient-portal.ts";

type PortalAuthAction = "signup" | "reset_password" | "send_access_link";

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const findAuthUserByEmail = async (email: string) => {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = (data?.users || []).find((user) => normalizeEmail(user.email) === email);
    if (found) return found;
    if ((data?.users || []).length < 1000) break;
  }
  return null;
};

const getInviteByToken = async (token: string) => {
  if (!token) return null;
  const tokenHash = await hmacHex(token);
  const { data, error } = await supabaseAdmin
    .from("patient_portal_invites")
    .select("id,patient_id,patient_email,psychologist_user_id,status,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const activationRedirect = (inviteToken?: string | null) => {
  const suffix = inviteToken
    ? `/portal/ativar?token=${encodeURIComponent(inviteToken)}`
    : "/portal/ativar";
  return `${appBaseUrl()}${suffix}`;
};

const assertInviteUsableForEmail = async (inviteToken: string, email: string) => {
  const invite = await getInviteByToken(inviteToken);
  if (!invite) return { response: errorResponse("Convite inválido ou expirado.", 400), invite: null };

  if (!["pending", "sent"].includes(String(invite.status))) {
    return { response: errorResponse("Este convite não está mais disponível.", 409), invite };
  }

  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin
      .from("patient_portal_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return { response: errorResponse("Este convite expirou. Solicite um novo envio.", 410), invite };
  }

  if (normalizeEmail(invite.patient_email) !== email) {
    await auditPortal({
      actor_type: "patient",
      psychologist_user_id: invite.psychologist_user_id,
      patient_id: invite.patient_id,
      invite_id: invite.id,
      action: "portal_auth_email_mismatch",
      metadata: { email },
    });
    return { response: errorResponse("Use o mesmo e-mail que recebeu o convite.", 403), invite };
  }

  return { response: null, invite };
};

const getActionLink = async (params: {
  type: "magiclink" | "recovery";
  email: string;
  redirectTo: string;
}) => {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: params.type,
    email: params.email,
    options: {
      redirectTo: params.redirectTo,
    },
  } as any);

  if (error) throw error;
  const actionLink = (data as any)?.properties?.action_link;
  if (!actionLink) throw new Error("Não foi possível gerar link de autenticação.");
  return String(actionLink);
};

const renderPatientEmail = (params: {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  actionUrl: string;
  helper?: string;
}) => `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;background:#050506;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#f7f7f8;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:#101014;padding:32px;">
            <tr>
              <td style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;font-weight:800;">${escapeHtml(params.eyebrow)}</td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-size:30px;line-height:1.08;color:#ffffff;font-weight:900;">${escapeHtml(params.title)}</td>
            </tr>
            <tr>
              <td style="padding-top:18px;color:#d4d4d8;font-size:15px;line-height:1.65;">${escapeHtml(params.body)}</td>
            </tr>
            <tr>
              <td style="padding-top:28px;">
                <a href="${escapeHtml(params.actionUrl)}" style="display:inline-block;padding:15px 22px;border-radius:16px;background:#ffffff;color:#050506;text-decoration:none;font-weight:900;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">${escapeHtml(params.ctaLabel)}</a>
              </td>
            </tr>
            ${params.helper ? `<tr><td style="padding-top:22px;color:#a1a1aa;font-size:13px;line-height:1.6;">${escapeHtml(params.helper)}</td></tr>` : ""}
            <tr>
              <td style="padding-top:28px;color:#71717a;font-size:12px;line-height:1.6;">Se você não solicitou este acesso, ignore este e-mail.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const sendPortalEmail = async (params: {
  to: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  actionUrl: string;
  helper?: string;
  psychologistUserId?: string | null;
}) =>
  deliverPatientEmail({
    db: supabaseAdmin,
    userId: params.psychologistUserId || "00000000-0000-0000-0000-000000000000",
    senderName: "NeuroNex Segurança",
    senderEmail: "seguranca@email.neuronex.site",
    to: params.to,
    subject: params.subject,
    html: renderPatientEmail({
      eyebrow: "Portal do Paciente",
      title: params.title,
      body: params.body,
      ctaLabel: params.ctaLabel,
      actionUrl: params.actionUrl,
      helper: params.helper,
    }),
    senderProfile: "security",
  });

const markPatientMetadata = async (user: any) => {
  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      account_role: (user.app_metadata as any)?.account_role || "patient",
      portal_source: (user.app_metadata as any)?.portal_source || "patient_portal_auth",
    },
    user_metadata: {
      ...(user.user_metadata || {}),
      role: (user.user_metadata as any)?.role || "patient",
      account_role: (user.user_metadata as any)?.account_role || "patient",
    },
  } as any);
};

const sendAccessLink = async (params: {
  email: string;
  inviteToken?: string;
  invite?: any;
  title?: string;
  subject?: string;
  body?: string;
  ctaLabel?: string;
}) => {
  const redirectTo = activationRedirect(params.inviteToken);
  const actionLink = await getActionLink({ type: "magiclink", email: params.email, redirectTo });
  await sendPortalEmail({
    to: params.email,
    subject: params.subject || "Acesse seu Portal NeuroNex",
    title: params.title || "Seu acesso ao Portal está pronto",
    body:
      params.body ||
      "Clique no botão abaixo para entrar com segurança no Portal do Paciente. Se houver um convite pendente, você poderá ativá-lo com o código recebido por e-mail.",
    ctaLabel: params.ctaLabel || "Acessar Portal",
    actionUrl: actionLink,
    helper: params.inviteToken
      ? "Este link mantém você no fluxo do convite. Se ele não abrir corretamente, entre em /portal/ativar e informe o código recebido."
      : "Se você recebeu um código de ativação, use-o em /portal/ativar após entrar.",
    psychologistUserId: params.invite?.psychologist_user_id,
  });
  return { redirectTo };
};

const handleSignup = async (body: Record<string, unknown>) => {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const inviteToken = String(body.inviteToken || "").trim();

  if (!isValidEmail(email)) return errorResponse("Informe um e-mail válido.", 400);

  let invite: any = null;
  if (inviteToken) {
    const validated = await assertInviteUsableForEmail(inviteToken, email);
    if (validated.response) return validated.response;
    invite = validated.invite;
  }

  let user = await findAuthUserByEmail(email);
  let created = false;

  if (!user) {
    if (password.length < 6) return errorResponse("A senha precisa ter pelo menos 6 caracteres.", 400);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "patient",
        account_role: "patient",
      },
      app_metadata: {
        account_role: "patient",
        portal_source: "patient_portal_auth",
      },
    });
    if (error || !data?.user) {
      console.error("[patient-portal-auth:create-user]", error);
      return errorResponse(error?.message || "Não foi possível criar a conta do paciente.", 400);
    }
    user = data.user;
    created = true;
  } else {
    await markPatientMetadata(user);
  }

  const access = await sendAccessLink({
    email,
    inviteToken,
    invite,
    subject: created ? "Ative sua conta do Portal NeuroNex" : "Acesse seu Portal NeuroNex",
    title: created ? "Sua conta do Portal está pronta" : "Sua conta já existe",
    body: created
      ? "Criamos sua conta do Portal do Paciente. Clique no botão abaixo para entrar e concluir a ativação do convite."
      : "Encontramos uma conta com este e-mail. Clique no botão abaixo para entrar no Portal; se você não lembra a senha, use Redefinir senha do Portal.",
    ctaLabel: created ? "Ativar Portal" : "Acessar Portal",
  });

  await auditPortal({
    actor_type: "patient",
    actor_user_id: user.id,
    psychologist_user_id: invite?.psychologist_user_id || null,
    patient_user_id: user.id,
    patient_id: invite?.patient_id || null,
    invite_id: invite?.id || null,
    action: created ? "portal_patient_signup_created" : "portal_patient_existing_access_sent",
    metadata: { email },
  });

  return jsonResponse({
    status: created ? "created" : "existing_user",
    email,
    redirectTo: access.redirectTo,
    message: created
      ? "Conta criada. Enviamos o e-mail de ativação do Portal do Paciente."
      : "Essa conta já existe. Enviamos um novo link de acesso; se precisar, use Redefinir senha do Portal.",
  });
};

const handleSendAccessLink = async (body: Record<string, unknown>) => {
  const email = normalizeEmail(body.email);
  const inviteToken = String(body.inviteToken || "").trim();

  if (!isValidEmail(email)) return errorResponse("Informe um e-mail válido.", 400);

  let invite: any = null;
  if (inviteToken) {
    const validated = await assertInviteUsableForEmail(inviteToken, email);
    if (validated.response) return validated.response;
    invite = validated.invite;
  }

  const user = await findAuthUserByEmail(email);
  if (user) {
    await markPatientMetadata(user);
    const access = await sendAccessLink({
      email,
      inviteToken,
      invite,
      subject: "Seu link de acesso ao Portal NeuroNex",
      title: "Entre no Portal do Paciente",
      body: "Use este link para entrar com segurança e continuar a ativação do seu Portal do Paciente.",
      ctaLabel: "Acessar Portal",
    });

    await auditPortal({
      actor_type: "patient",
      actor_user_id: user.id,
      psychologist_user_id: invite?.psychologist_user_id || null,
      patient_user_id: user.id,
      patient_id: invite?.patient_id || null,
      invite_id: invite?.id || null,
      action: "portal_access_link_sent",
      metadata: { email, redirectTo: access.redirectTo },
    });
  }

  return jsonResponse({
    status: user ? "access_link_sent" : "sent_if_exists",
    email,
    message: "Se houver uma conta de paciente com este e-mail, enviaremos um link de acesso ao Portal.",
  });
};

const handleResetPassword = async (body: Record<string, unknown>) => {
  const email = normalizeEmail(body.email);
  const inviteToken = String(body.inviteToken || "").trim();
  if (!isValidEmail(email)) return errorResponse("Informe um e-mail válido.", 400);

  let invite: any = null;
  if (inviteToken) {
    const validated = await assertInviteUsableForEmail(inviteToken, email);
    if (validated.response) return validated.response;
    invite = validated.invite;
  }

  const user = await findAuthUserByEmail(email);
  if (user) {
    const tokenSuffix = inviteToken ? `&token=${encodeURIComponent(inviteToken)}` : "";
    const redirectTo = `${appBaseUrl()}/reset-password?next=portal${tokenSuffix}`;
    const actionLink = await getActionLink({ type: "recovery", email, redirectTo });
    await sendPortalEmail({
      to: email,
      subject: "Redefinir senha do Portal NeuroNex",
      title: "Redefina sua senha do Portal",
      body: "Recebemos uma solicitação para redefinir sua senha do Portal do Paciente. Clique abaixo para criar uma nova senha.",
      ctaLabel: "Redefinir senha",
      actionUrl: actionLink,
      helper: "Depois de salvar a nova senha, você voltará para o Portal do Paciente.",
    });

    await auditPortal({
      actor_type: "patient",
      actor_user_id: user.id,
      psychologist_user_id: invite?.psychologist_user_id || null,
      patient_user_id: user.id,
      patient_id: invite?.patient_id || null,
      invite_id: invite?.id || null,
      action: "portal_password_reset_sent",
      metadata: { email, redirectTo },
    });
  }

  return jsonResponse({
    status: "sent_if_exists",
    message: "Se houver uma conta de paciente com este e-mail, enviaremos o link de redefinição.",
  });
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return errorResponse("Método não permitido.", 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "signup") as PortalAuthAction;

    if (action === "signup") return await handleSignup(body);
    if (action === "reset_password") return await handleResetPassword(body);
    if (action === "send_access_link") return await handleSendAccessLink(body);

    return errorResponse("Ação inválida.", 400);
  } catch (error) {
    console.error("[patient-portal-auth]", error);
    return errorResponse(error instanceof Error ? error.message : "Não foi possível concluir a ação.", 500);
  }
});
