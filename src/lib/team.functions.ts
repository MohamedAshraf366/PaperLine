import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMember } from "./documents.functions";

export type Member = {
  id: string;
  userId: string;
  role: string;
  email: string | null;
  fullName: string | null;
  joinedAt: string;
};

export type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
};

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data, context }): Promise<{ members: Member[]; invites: Invite[] }> => {
    await assertMember(context.supabase, data.workspaceId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabaseAdmin
        .from("paperline_workspace_members")
        .select("id, user_id, role, created_at")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("paperline_invites")
        .select("id, email, role, status, token, expires_at, created_at")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false }),
    ]);
    const ids = (memberRows ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("paperline_profiles")
      .select("id, email, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      members: (memberRows ?? []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        email: byId.get(m.user_id)?.email ?? null,
        fullName: byId.get(m.user_id)?.full_name ?? null,
        joinedAt: m.created_at,
      })),
      invites: (inviteRows ?? []) as Invite[],
    };
  });

async function requireManager(workspaceId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("paperline_workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !["owner", "admin"].includes(data.role))
    throw new Error("Only workspace owners and admins can manage the team.");
}

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string; email: string; role: "admin" | "member" }) => data)
  .handler(async ({ data, context }) => {
    await requireManager(data.workspaceId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ws } = await supabaseAdmin
      .from("paperline_workspaces")
      .select("plan_id, paperline_plans(max_seats)")
      .eq("id", data.workspaceId)
      .single();
    const maxSeats = (ws as unknown as { paperline_plans: { max_seats: number } | null })
      ?.paperline_plans?.max_seats;
    if (maxSeats) {
      const [{ count: members }, { count: pending }] = await Promise.all([
        supabaseAdmin
          .from("paperline_workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId),
        supabaseAdmin
          .from("paperline_invites")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", data.workspaceId)
          .eq("status", "pending"),
      ]);
      if ((members ?? 0) + (pending ?? 0) >= maxSeats)
        throw new Error(`Your plan includes ${maxSeats} seats. Upgrade to invite more people.`);
    }

    const email = data.email.trim().toLowerCase();
    const { data: row, error } = await supabaseAdmin
      .from("paperline_invites")
      .insert({
        workspace_id: data.workspaceId,
        email,
        role: data.role,
        invited_by: context.userId,
      })
      .select("token")
      .single();
    if (error) throw new Error(error.message);
    return { token: row.token as string };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string; inviteId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireManager(data.workspaceId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("paperline_invites")
      .update({ status: "revoked" })
      .eq("id", data.inviteId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { workspaceId: string; memberId: string; role: "admin" | "member" }) => data,
  )
  .handler(async ({ data, context }) => {
    await requireManager(data.workspaceId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("paperline_workspace_members")
      .update({ role: data.role })
      .eq("id", data.memberId)
      .eq("workspace_id", data.workspaceId)
      .neq("role", "owner");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string; memberId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireManager(data.workspaceId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("paperline_workspace_members")
      .delete()
      .eq("id", data.memberId)
      .eq("workspace_id", data.workspaceId)
      .neq("role", "owner");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Accepts an invite for the signed-in user, matching on their email address. */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = ((context.claims["email"] as string | undefined) ?? "").toLowerCase();
    const { data: invite } = await supabaseAdmin
      .from("paperline_invites")
      .select("id, workspace_id, email, role, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) throw new Error("That invite link is not valid.");
    if (invite.status !== "pending") throw new Error("That invite has already been used.");
    if (new Date(invite.expires_at) < new Date()) throw new Error("That invite has expired.");
    if (invite.email.toLowerCase() !== email)
      throw new Error(`This invite was sent to ${invite.email}. Sign in with that email.`);

    const { error } = await supabaseAdmin
      .from("paperline_workspace_members")
      .upsert(
        { workspace_id: invite.workspace_id, user_id: context.userId, role: invite.role },
        { onConflict: "workspace_id,user_id" },
      );
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("paperline_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);
    return { workspaceId: invite.workspace_id as string };
  });

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("paperline_plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Switches the workspace plan. Billing is not connected yet. */
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string; planId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireManager(data.workspaceId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("paperline_workspaces")
      .update({ plan_id: data.planId })
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
