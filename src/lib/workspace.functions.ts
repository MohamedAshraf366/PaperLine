import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkspaceContext = {
  userId: string;
  email: string;
  fullName: string | null;
  isPlatformAdmin: boolean;
  workspace: { id: string; name: string; plan_id: string; suspended: boolean; role: string };
  plan: {
    id: string;
    name: string;
    max_documents: number;
    max_storage_bytes: number;
    max_questions_month: number;
    max_seats: number;
    price_cents: number;
    features: string[];
  };
  usage: { documents: number; storageBytes: number; questionsThisMonth: number; seats: number };
};

export const getWorkspaceContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceContext> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = (context.claims["email"] as string | undefined) ?? "";
    const fullName =
      ((context.claims["user_metadata"] as Record<string, unknown> | undefined)?.["full_name"] as
        string | undefined) ?? null;

    await supabaseAdmin
      .from("paperline_profiles")
      .upsert({ id: userId, email, full_name: fullName }, { onConflict: "id" });

    let { data: membership } = await supabaseAdmin
      .from("paperline_workspace_members")
      .select("workspace_id, role, paperline_workspaces(id, name, plan_id, suspended)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership) {
      const { data: ws, error } = await supabaseAdmin
        .from("paperline_workspaces")
        .insert({
          name: fullName ? `${fullName.split(" ")[0]}'s workspace` : "My workspace",
          owner_id: userId,
          plan_id: "free",
        })
        .select("id, name, plan_id, suspended")
        .single();
      if (error) throw new Error(error.message);
      const { error: memberError } = await supabaseAdmin
        .from("paperline_workspace_members")
        .insert({ workspace_id: ws.id, user_id: userId, role: "owner" });
      if (memberError) throw new Error(memberError.message);
      membership = {
        workspace_id: ws.id,
        role: "owner",
        paperline_workspaces: ws,
      } as unknown as typeof membership;
    }

    const ws = (
      membership as {
        paperline_workspaces: { id: string; name: string; plan_id: string; suspended: boolean };
      }
    ).paperline_workspaces;

    const [{ data: plan }, { data: adminRow }, docs, seats, questions] = await Promise.all([
      supabaseAdmin.from("paperline_plans").select("*").eq("id", ws.plan_id).single(),
      supabaseAdmin
        .from("paperline_user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
      supabaseAdmin.from("paperline_documents").select("size_bytes").eq("workspace_id", ws.id),
      supabaseAdmin
        .from("paperline_workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws.id),
      supabaseAdmin
        .from("paperline_usage_events")
        .select("amount")
        .eq("workspace_id", ws.id)
        .eq("kind", "question")
        .gte(
          "created_at",
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        ),
    ]);

    const documents = docs.data ?? [];
    return {
      userId,
      email,
      fullName,
      isPlatformAdmin: !!adminRow,
      workspace: { ...ws, role: (membership as { role: string }).role },
      plan: {
        ...(plan as WorkspaceContext["plan"]),
        features: ((plan as { features?: unknown })?.features as string[]) ?? [],
      },
      usage: {
        documents: documents.length,
        storageBytes: documents.reduce((sum, d) => sum + Number(d.size_bytes ?? 0), 0),
        questionsThisMonth: (questions.data ?? []).reduce((s, e) => s + Number(e.amount ?? 1), 0),
        seats: seats.count ?? 1,
      },
    };
  });

export const renameWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { workspaceId: string; name: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("paperline_workspaces")
      .update({ name: data.name.slice(0, 80) })
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
