import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "لم يتم إعداد Supabase بعد. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY إلى ملف البيئة.",
    );
  }
  return supabase;
}

export function toArabicDistance(meters) {
  if (meters === null || meters === undefined) return "";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} كم` : `${Math.round(meters)} م`;
}

export function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((date.getTime() - Date.now()) / 60000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `بعد ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  return `بعد ${hours} ساعة`;
}

export async function getSession() {
  if (!supabase) return { session: null, error: new Error("Supabase غير مُعد") };
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}
