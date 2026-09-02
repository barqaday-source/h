// جمجم matchmaker: invoke from a Supabase Database Webhook on matches/match_participants.
// Required secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await request.json();
    const matchId = body.record?.id ?? body.match_id ?? body.matchId;
    if (!matchId) return json({ error: "match_id is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id,max_players,status,created_by")
      .eq("id", matchId)
      .single();
    if (matchError) throw matchError;
    if (match.status !== "open") return json({ matchId, invited: 0, reason: "match_not_open" });

    const { count: participantCount, error: countError } = await supabase
      .from("match_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("match_id", matchId)
      .eq("status", "confirmed");
    if (countError) throw countError;

    const missing = Math.max(0, (match.max_players ?? 10) - (participantCount ?? 0));
    if (!missing) return json({ matchId, invited: 0, reason: "match_full" });

    const { data: candidates, error: candidateError } = await supabase.rpc("jawk_find_candidates", {
      p_match_id: matchId,
      p_limit: Math.min(Math.max(missing * 3, 5), 30),
    });
    if (candidateError) throw candidateError;

    let invited = 0;
    for (const candidate of candidates ?? []) {
      const { error } = await supabase.from("match_invitations").upsert(
        {
          match_id: matchId,
          inviter_id: match.created_by,
          invitee_id: candidate.user_id,
          status: "pending",
        },
        { onConflict: "match_id,invitee_id", ignoreDuplicates: true },
      );
      if (!error) invited += 1;
    }
    return json({ matchId, missing, invited });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "matchmaker_failed" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
