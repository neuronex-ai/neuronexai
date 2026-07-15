import {
  corsResponse,
  errorResponse,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import { deliverPatientEmail, escapeHtml } from "../_shared/email-delivery.ts";
import {
  PORTAL_INVITE_DAYS,
  PORTAL_MAX_ATTEMPTS,
  addDaysIso,
  appBaseUrl,
  auditPortal,
  generateActivationCode,
  generatePortalToken,
  hmacHex,
  publicProfessionalName,
  requirePsychologistPortalAccess,
} from "../_shared/patient-portal.ts";

const getActionLink = async (params: { email: string; redirectTo: string }) => {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: params.email,
    options: { redirectTo: params.redirectTo },
  } as any);

  if (error) throw error;
  const actionLink = (data as any)?.properties?.action_link;
  if (!actionLink) throw new Error("Não foi possível gerar link de acesso ao Portal.");
  return String(actionLink);
};

const renderPortalAccessEmail = (params: {
  patientName: string;
  professionalName: string;
  actionUrl: string;
}) => `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Acesse seu Portal NeuroNex</title>
  </head>
  <body style="margin:0;background:#050506;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#f7f7f8;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:#101014;padding:32px;">
            <tr><td style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;font-weight:800;">Portal do Paciente</td></tr>
            <tr><td style="padding-top:16px;font-size:30px;line-height:1.08;color:#ffffff;font-weight:900;">Seu acesso ao Portal está pronto</td></tr>
            <tr><td style="padding-top:18px;color:#d4d4d8;font-size:15px;line-height:1.65;">Olá, ${escapeHtml(params.patientName)}. ${escapeHtml(params.professionalName)} reenviou seu acesso seguro ao Portal do Paciente da NeuroNex.</td></tr>
            <tr><td style="padding-top:28px;"><a href="${escapeHtml(params.actionUrl)}" style="display:inline-block;padding:15px 22px;border-radius:16px;background:#ffffff;color:#050506;text-decoration:none;font-weight:900;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">Acessar Portal</a></td></tr>
            <tr><td style="padding-top:22px;color:#a1a1aa;font-size:13px;line-height:1.6;">Se você tiver um convite pendente, informe o código recebido por e-mail em /portal/ativar.</td></tr>
            <tr><td style="padding-top:28px;color:#71717a;font-size:12px;line-height:1.6;">Se você não solicitou este acesso, ignore este e-mail.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return errorResponse("Método não permitido.", 405);

  try {
    const access = await requirePsychologistPortalAccess(req);
    if (access.response) return access.response;
    const user = access.user;

    const body = await req.json().catch(() => ({}));
    const patientId = String(body.patientId || "").trim();
    if (!patientId) return errorResponse("Paciente não informado.", 400);

    const patientResult = await supabaseAdmin
      .from("patients")
      .select("id,user_id,name,email")
      .eq("id", patientId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (patientResult.error) throw patientResult.error;
    const patient = patientResult.data;
    if (!patient) return errorResponse("Paciente não encontrado para esta conta.", 404);
    if (!patient.email) return errorResponse("Paciente sem e-mail cadastrado.", 400);

    const linkResult = await supabaseAdmin
      .from("patient_portal_links")
      .select("id,status,patient_user_id,created_at")
      .eq("psychologist_user_id", user.id)
      .eq("patient_id", patient.id)
      .maybeSingle();
    if (linkResult.error) throw linkResult.error;
    if (linkResult.data?.status === "active") {
      const profileResult = await supabaseAdmin
        .from("profiles")
        .select("id,first_name,last_name,full_name,name,clinic_name,avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (profileResult.error) throw profileResult.error;
      const professionalName = publicProfessionalName(profileResult.data);
      const firstName = String(patient.name || "Paciente").split(" ")[0];
      const actionLink = await getActionLink({
        email: String(patient.email).trim().toLowerCase(),
        redirectTo: `${appBaseUrl()}/portal`,
      });
      const delivery = await deliverPatientEmail({
        db: supabaseAdmin,
        userId: user.id,
        senderName: professionalName,
        senderEmail: user.email || "seguranca@email.neuronex.site",
        to: String(patient.email).trim(),
        subject: "Acesse seu Portal NeuroNex",
        html: renderPortalAccessEmail({
          patientName: firstName,
          professionalName,
          actionUrl: actionLink,
        }),
        senderProfile: "security",
      });

      await auditPortal({
        actor_type: "psychologist",
        actor_user_id: user.id,
        psychologist_user_id: user.id,
        patient_user_id: linkResult.data.patient_user_id,
        patient_id: patient.id,
        link_id: linkResult.data.id,
        action: "portal_access_resent",
        metadata: { provider: delivery.provider, provider_message_id: delivery.providerMessageId },
      });

      return jsonResponse({
        status: "linked",
        message: "Paciente já conectado. Reenviamos um link de acesso ao Portal.",
        link: linkResult.data,
      });
    }

    const portalLinkLimit = access.entitlement.portalLinkLimit;
    if (typeof portalLinkLimit === "number") {
      const { count, error: countError } = await supabaseAdmin
        .from("patient_portal_links")
        .select("id", { count: "exact", head: true })
        .eq("psychologist_user_id", user.id)
        .eq("status", "active")
        .neq("patient_id", patient.id);
      if (countError) throw countError;
      if (Number(count || 0) >= portalLinkLimit) {
        return errorResponse("Limite de vinculos ativos do Portal do Paciente atingido.", 409, {
          code: "patient_portal_link_limit_reached",
          limit: portalLinkLimit,
          used: Number(count || 0),
        });
      }
    }

    const profileResult = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,last_name,full_name,name,clinic_name,avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data;
    const professionalName = publicProfessionalName(profile);
    const clinicName = profile?.clinic_name || "NeuroNex";

    const token = generatePortalToken();
    const activationCode = generateActivationCode();
    const tokenHash = await hmacHex(token);
    const codeHash = await hmacHex(activationCode);
    const expiresAt = addDaysIso(PORTAL_INVITE_DAYS);

    await supabaseAdmin
      .from("patient_portal_invites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        metadata: { revoked_by: "new_invite" },
      })
      .eq("psychologist_user_id", user.id)
      .eq("patient_id", patient.id)
      .in("status", ["pending", "sent"]);

    const inviteResult = await supabaseAdmin
      .from("patient_portal_invites")
      .insert({
        psychologist_user_id: user.id,
        patient_id: patient.id,
        patient_email: String(patient.email).trim().toLowerCase(),
        token_hash: tokenHash,
        activation_code_hash: codeHash,
        status: "pending",
        expires_at: expiresAt,
        max_attempts: PORTAL_MAX_ATTEMPTS,
        metadata: {
          source: "create-patient-portal-invite",
          patient_name: patient.name,
        },
      })
      .select("*")
      .single();
    if (inviteResult.error) throw inviteResult.error;

    await auditPortal({
      actor_type: "psychologist",
      actor_user_id: user.id,
      psychologist_user_id: user.id,
      patient_id: patient.id,
      invite_id: inviteResult.data.id,
      action: "invite_created",
      metadata: { source: "create-patient-portal-invite" },
    });

    const actionUrl = `${appBaseUrl()}/portal/convite/${encodeURIComponent(token)}`;
    const firstName = String(patient.name || "Paciente").split(" ")[0];
    const subject = "Ative seu Portal NeuroNex";
    const html = `
      <div style="margin:0;padding:32px;background:#050506;font-family:Inter,Arial,sans-serif;color:#f7f7f8">
        <div style="max-width:620px;margin:0 auto;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:#101014;padding:32px">
          <p style="margin:0 0 12px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af">Portal do Paciente</p>
          <h1 style="margin:0;font-size:30px;line-height:1.08;color:#ffffff">Seu acesso seguro está pronto</h1>
          <p style="margin:20px 0 0;color:#d4d4d8;font-size:15px;line-height:1.65">Olá, ${escapeHtml(firstName)}. ${escapeHtml(professionalName)} convidou você para acessar o Portal do Paciente da NeuroNex.</p>
          <div style="margin:28px 0;padding:22px;border-radius:22px;background:#ffffff;color:#09090b;text-align:center">
            <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#71717a">Código de ativação</p>
            <p style="margin:0;font-size:34px;font-weight:900;letter-spacing:.24em">${escapeHtml(activationCode)}</p>
          </div>
          <p style="margin:0 0 24px;color:#a1a1aa;font-size:13px;line-height:1.6">Clique no botão abaixo para entrar ou criar sua conta. Se o link não abrir corretamente, use este código em /portal/ativar para vincular seu acesso ao consultório ${escapeHtml(clinicName)}.</p>
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:15px 22px;border-radius:16px;background:#ffffff;color:#050506;text-decoration:none;font-weight:900;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Ativar Portal</a>
          <p style="margin:28px 0 0;color:#71717a;font-size:12px;line-height:1.6">Este convite expira em ${PORTAL_INVITE_DAYS} dias. Se você não reconhece este convite, ignore este e-mail.</p>
        </div>
      </div>
    `;

    try {
      const delivery = await deliverPatientEmail({
        db: supabaseAdmin,
        userId: user.id,
        senderName: professionalName,
        senderEmail: user.email || "notificacoes@email.neuronex.site",
        to: String(patient.email).trim(),
        subject,
        html,
        senderProfile: "security",
      });

      await supabaseAdmin
        .from("patient_portal_invites")
        .update({
          status: "sent",
          sent_count: 1,
          last_sent_at: new Date().toISOString(),
          metadata: {
            ...inviteResult.data.metadata,
            delivery_provider: delivery.provider,
            provider_message_id: delivery.providerMessageId,
            gmail_error: delivery.gmailError,
          },
        })
        .eq("id", inviteResult.data.id);

      await auditPortal({
        actor_type: "psychologist",
        actor_user_id: user.id,
        psychologist_user_id: user.id,
        patient_id: patient.id,
        invite_id: inviteResult.data.id,
        action: "invite_sent",
        metadata: { provider: delivery.provider },
      });
    } catch (emailError) {
      await supabaseAdmin
        .from("patient_portal_invites")
        .update({
          metadata: {
            ...inviteResult.data.metadata,
            delivery_error: emailError instanceof Error ? emailError.message : "email_error",
          },
        })
        .eq("id", inviteResult.data.id);
      throw emailError;
    }

    return jsonResponse({
      status: "sent",
      inviteId: inviteResult.data.id,
      expiresAt,
      patientEmail: patient.email,
      portalUrl: actionUrl,
      activationCode,
      message: "Convite enviado com sucesso.",
    });
  } catch (error) {
    console.error("[create-patient-portal-invite]", error);
    return errorResponse(error instanceof Error ? error.message : "Não foi possível enviar o convite.", 500);
  }
});
