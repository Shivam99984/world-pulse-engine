import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function sha256(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("api_keys")
      .select("id,name,key_prefix,last_used_at,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { keys: data ?? [] };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { name: string }) =>
    z.object({ name: z.string().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const raw =
      "gp_live_" +
      Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const hash = await sha256(raw);
    const prefix = raw.slice(0, 12);
    const { error } = await context.supabase
      .from("api_keys")
      .insert({ user_id: context.userId, name: data.name, key_prefix: prefix, key_hash: hash });
    if (error) throw new Error(error.message);
    return { key: raw, prefix };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export async function verifyApiKey(raw: string | null) {
  if (!raw || !raw.startsWith("gp_")) return null;
  const hash = await sha256(raw);
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("id,user_id")
    .eq("key_hash", hash)
    .maybeSingle();
  if (data) {
    await supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
  }
  return data;
}
