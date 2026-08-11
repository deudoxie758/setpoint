import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/env";

export const CLIPS_BUCKET = "clips";

let supabase: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }
  return supabase;
}

export async function createSignedUploadUrl(path: string) {
  const { data, error } = await getClient().storage.from(CLIPS_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return data;
}

export function publicUrlFor(path: string) {
  const { data } = getClient().storage.from(CLIPS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
