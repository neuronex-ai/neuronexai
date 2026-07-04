import {
  corsResponse,
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
  auditPortal,
  getPatientPortalContext,
  hmacHex,
} from "../_shared/patient-portal.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return errorResponse("Metodo nao permitido.", 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const code = String(body.code || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      return errorResponse("Informe o codigo de 6 digitos.", 400);
    }
    if (!user.email) return errorResponse("Sua conta precisa ter e-mail confirmado.", 400);

    const normalizedEmail = String(user.email).trim().toLowerCase();
    const codeHash = await hmacHex(code);
    let tokenInvite: Record<string, any> | null = null;

    if (token) {
      const tokenHash = await hmacHex(token);
      const inviteResult = await supabaseAdmin
        .from("patient_portal_invites")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (inviteResult.error) throw inviteResult.error;
      tokenInvite = inviteResult.data;
    }

    let invite = tokenInvite;
    const tokenInviteIsUsable =
      invite &&
      ["pending", "sent"].includes(invite.status) &&
      new Date(invite.expires_at).getTime() > Date.now();

    if (!tokenInviteIsUsable) {
      const fallbackResult = await supabaseAdmin
        .from("patient_portal_invites")
        .select("*")
        .eq("patient_email", normalizedEmail)
        .eq("activation_code_hash", codeHash)
        .in("status", ["pending", "sent"])
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallbackResult.error) throw fallbackResult.error;
      invite = fallbackResult.data || tokenInvite;
    }

    if (!invite) return errorResponse("Convite invalido ou expirado.", 404, { code: "invalid_invite" });

    const existingLinkResult = await supabaseAdmin
      .from("patient_portal_links")
      .select("id,patient_user_id,status")
      .eq("psychologist_user_id", invite.psychologist_user_id)
      .eq("patient_id", invite.patient_id)
      .maybeSingle();
    if (existingLinkResult.error) throw existingLinkResult.error;

    const existingLink = existingLinkResult.data;
    if (existingLink?.patient_user_id && existingLink.patient_user_id !== user.id) {
      await auditPortal({
        actor_type: "patient",
        actor_user_id: user.id,
        psychologist_user_id: invite.psychologist_user_id,
        patient_user_id: user.id,
        patient_id: invite.patient_id,
        invite_id: invite.id,
        link_id: existingLink.id,
        action: "activation_link_taken_by_other_user",
      });
      return errorResponse("Este convite ja foi ativado por outra conta de paciente.", 409, {
        code: "link_belongs_to_other_patient_user",
      });
    }

    if (existingLink?.patient_user_id === user.id && existingLink.status === "active") {
      const context = await getPatientPortalContext({ id: user.id, email: user.email });
      return jsonResponse(context);
    }

    if (new Date(invite.expires_at).getTime() <= Date.now() && ["pending", "sent"].includes(invite.status)) {
      await supabaseAdmin
        .from("patient_portal_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return errorResponse("Convite expirado.", 410, { code: "expired_invite" });
    }

    if (!["pending", "sent"].includes(invite.status)) {
      return errorResponse("Convite indisponivel.", 409, { code: `invite_${invite.status}` });
    }

    if (normalizedEmail !== String(invite.patient_email).trim().toLowerCase()) {
      await auditPortal({
        actor_type: "patient",
        actor_user_id: user.id,
        psychologist_user_id: invite.psychologist_user_id,
        patient_user_id: user.id,
        patient_id: invite.patient_id,
        invite_id: invite.id,
        action: "activation_email_mismatch",
        metadata: { user_email: user.email },
      });
      return errorResponse("Entre com o mesmo e-mail que recebeu o convite.", 403, { code: "email_mismatch" });
    }

    const attempts = Number(invite.activation_attempts || 0);
    const maxAttempts = Number(invite.max_attempts || 5);
    if (attempts >= maxAttempts) {
      await supabaseAdmin
        .from("patient_portal_invites")
        .update({ status: "blocked", blocked_at: new Date().toISOString() })
        .eq("id", invite.id);
      return errorResponse("Codigo bloqueado por excesso de tentativas.", 423, { code: "activation_blocked" });
    }

    if (codeHash !== invite.activation_code_hash) {
      const nextAttempts = attempts + 1;
      await supabaseAdmin
        .from("patient_portal_invites")
        .update({
          activation_attempts: nextAttempts,
          status: nextAttempts >= maxAttempts ? "blocked" : invite.status,
          blocked_at: nextAttempts >= maxAttempts ? new Date().toISOString() : invite.blocked_at,
        })
        .eq("id", invite.id);

      await auditPortal({
        actor_type: "patient",
        actor_user_id: user.id,
        psychologist_user_id: invite.psychologist_user_id,
        patient_user_id: user.id,
        patient_id: invite.patient_id,
        invite_id: invite.id,
        action: "activation_code_failed",
        metadata: { attempts: nextAttempts, max_attempts: maxAttempts },
      });

      return errorResponse("Codigo incorreto.", 401, {
        code: "invalid_activation_code",
        attemptsRemaining: Math.max(0, maxAttempts - nextAttempts),
      });
    }

    const linkResult = await supabaseAdmin
      .from("patient_portal_links")
      .upsert({
        patient_user_id: user.id,
        psychologist_user_id: invite.psychologist_user_id,
        patient_id: invite.patient_id,
        invite_id: invite.id,
        status: "active",
        activated_at: new Date().toISOString(),
        revoked_at: null,
        suspended_at: null,
      }, { onConflict: "psychologist_user_id,patient_id" })
      .select("*")
      .single();
    if (linkResult.error) throw linkResult.error;

    await supabaseAdmin
      .from("patient_portal_invites")
      .update({
        status: "activated",
        activated_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    await auditPortal({
      actor_type: "patient",
      actor_user_id: user.id,
      psychologist_user_id: invite.psychologist_user_id,
      patient_user_id: user.id,
      patient_id: invite.patient_id,
      invite_id: invite.id,
      link_id: linkResult.data.id,
      action: "portal_activated",
    });

    const context = await getPatientPortalContext({ id: user.id, email: user.email });
    return jsonResponse(context);
  } catch (error) {
    console.error("[patient-portal-activate]", error);
    return errorResponse(error instanceof Error ? error.message : "Nao foi possivel ativar o portal.", 500);
  }
});
