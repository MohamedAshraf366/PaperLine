import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStats = {
  totals: { workspaces: number; documents: number; members: number; questions: number };
  workspaces: {
    id: string;
    name: string;
    plan_id: string;
    suspended: boolean;
    documents: number;
    members: number;
    created_at: string;
  }[];
  daily: { day: string; uploads: number; questions: number }[];
};

async function requirePlatformAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("paperline_user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("You do not have access to the admin area.");
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    await requirePlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 29 * 864e5).toISOString();

    const [{ data: workspaces }, { data: docs }, { data: members }, { data: events }] =
      await Promise.all([
        supabaseAdmin
          .from("paperline_workspaces")
          .select("id, name, plan_id, suspended, created_at")
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("paperline_documents").select("id, workspace_id"),
        supabaseAdmin.from("paperline_workspace_members").select("id, workspace_id"),
        supabaseAdmin
          .from("paperline_usage_events")
          .select("kind, amount, created_at")
          .gte("created_at", since),
      ]);

    const docCount = new Map<string, number>();
    for (const d of docs ?? [])
      docCount.set(d.workspace_id, (docCount.get(d.workspace_id) ?? 0) + 1);
    const memberCount = new Map<string, number>();
    for (const m of members ?? [])
      memberCount.set(m.workspace_id, (memberCount.get(m.workspace_id) ?? 0) + 1);

    const days = new Map<string, { uploads: number; questions: number }>();
    for (let i = 29; i >= 0; i--)
      days.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), {
        uploads: 0,
        questions: 0,
      });
    let questions = 0;
    for (const e of events ?? []) {
      const day = String(e.created_at).slice(0, 10);
      const row = days.get(day);
      const amount = Number(e.amount ?? 1);
      if (e.kind === "question") questions += amount;
      if (!row) continue;
      if (e.kind === "question") row.questions += amount;
      else row.uploads += amount;
    }

    return {
      totals: {
        workspaces: (workspaces ?? []).length,
        documents: (docs ?? []).length,
        members: (members ?? []).length,
        questions,
      },
      workspaces: (workspaces ?? []).map((w) => ({
        ...w,
        documents: docCount.get(w.id) ?? 0,
        members: memberCount.get(w.id) ?? 0,
      })),
      daily: [...days.entries()].map(([day, v]) => ({ day, ...v })),
    };
  });

export const setWorkspaceSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string; suspended: boolean }) => data)
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("paperline_workspaces")
      .update({ suspended: data.suspended })
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
