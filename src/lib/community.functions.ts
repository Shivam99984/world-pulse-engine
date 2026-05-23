import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listComments = createServerFn({ method: "GET" })
  .inputValidator((i: { eventId: string }) => i)
  .handler(async ({ data }) => {
    const { data: comments, error } = await supabaseAdmin
      .from("event_comments")
      .select("id,event_id,user_id,body,upvotes,created_at")
      .eq("event_id", data.eventId)
      .order("upvotes", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((comments ?? []).map((c) => c.user_id)));
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id,display_name").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
      userIds.length
        ? supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", userIds)
        : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
    ]);
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) =>
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]),
    );
    return {
      comments: (comments ?? []).map((c) => ({
        ...c,
        display_name: nameMap.get(c.user_id) ?? "Analyst",
        is_expert: (roleMap.get(c.user_id) ?? []).includes("expert"),
      })),
    };
  });

export const postComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { eventId: string; body: string }) =>
    z.object({ eventId: z.string().uuid(), body: z.string().min(2).max(2000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("event_comments")
      .insert({ event_id: data.eventId, user_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("user_reputation")
      .upsert(
        { user_id: context.userId, points: 0 },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    return { ok: true };
  });

export const reportEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { eventId: string; reason: string }) =>
    z.object({ eventId: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("event_reports")
      .insert({ event_id: data.eventId, user_id: context.userId, reason: data.reason });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { data: rep, error } = await supabaseAdmin
    .from("user_reputation")
    .select("user_id,points")
    .order("points", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const ids = (rep ?? []).map((r) => r.user_id);
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("profiles").select("id,display_name").in("id", ids)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    ids.length
      ? supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids)
      : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
  ]);
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const expertSet = new Set(
    (roles ?? []).filter((r) => r.role === "expert").map((r) => r.user_id),
  );
  return {
    leaders: (rep ?? []).map((r) => ({
      user_id: r.user_id,
      points: r.points,
      display_name: nameMap.get(r.user_id) ?? "Analyst",
      is_expert: expertSet.has(r.user_id),
    })),
  };
});
