import { formatRelativeTime, requireSupabase, toArabicDistance } from "@/lib/supabase";

export async function uploadStory(file) {
  if (!file) throw new Error("اختر صورة أو فيديو للقصة أولاً.");
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول لرفع قصة.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from("stories").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;
  const { data: publicUrlData } = client.storage.from("stories").getPublicUrl(path);
  const { data, error } = await client
    .from("stories")
    .insert({ user_id: userId, title: file.name.replace(/\\.[^/.]+$/, ""), image_url: publicUrlData.publicUrl })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export const roles = [
  { id: "player", label: "لاعب" },
  { id: "keeper", label: "حارس" },
  { id: "referee", label: "حكم" },
  { id: "coach", label: "مدرب" },
];

export async function fetchHomeData({ query = "" } = {}) {
  const client = requireSupabase();
  const [storiesResult, matchesResult, pinsResult] = await Promise.all([
    client
      .from("stories")
      .select("id,title,image_url,created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    client
      .from("matches")
      .select(
        "id,format,starts_at,max_players,venue:venues(id,name,latitude,longitude),participants:match_participants(count)",
      )
      .eq("status", "open")
      .order("starts_at", { ascending: true })
      .limit(20),
    client
      .from("venues")
      .select("id,name,address,latitude,longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(100),
  ]);
  const firstError = [storiesResult, matchesResult, pinsResult].find((item) => item.error)?.error;
  if (firstError) throw firstError;
  const needle = query.trim().toLowerCase();
  const matches = (matchesResult.data ?? [])
    .map((match) => {
      const count = match.participants?.[0]?.count ?? 0;
      const venueName = match.venue?.name ?? "ملعب غير مسمى";
      return {
        ...match,
        pitch: venueName,
        format: match.format ?? "5×5",
        distance: toArabicDistance(match.distance_meters),
        slots: `${count} من ${match.max_players ?? 10} لاعبين`,
        startsIn: formatRelativeTime(match.starts_at),
      };
    })
    .filter((match) => !needle || `${match.pitch} ${match.format}`.toLowerCase().includes(needle));
  return {
    stories: storiesResult.data ?? [],
    nearbyMatches: matches,
    mapPins: (pinsResult.data ?? []).map((venue) => ({ ...venue, active: false })),
  };
}

export async function fetchCurrentMatchId() {
  const configured = import.meta.env.VITE_DEFAULT_MATCH_ID;
  if (configured) return configured;
  const client = requireSupabase();
  const { data, error } = await client
    .from("matches")
    .select("id")
    .eq("status", "open")
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? "";
}

export async function fetchNotifications() {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول لعرض الإشعارات.");
  const { data, error } = await client
    .from("notifications")
    .select("id,kind,title,body,match_id,invitation_id,read_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function respondToInvitation(invitationId, status) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول للرد على الدعوة.");
  const { data, error } = await client
    .from("match_invitations")
    .update({ status })
    .eq("id", invitationId)
    .eq("invitee_id", userId)
    .select("id,match_id,status")
    .single();
  if (error) throw error;
  if (status === "accepted") {
    const { error: participantError } = await client
      .from("match_participants")
      .upsert({ match_id: data.match_id, user_id: userId, status: "confirmed" }, { onConflict: "match_id,user_id" });
    if (participantError) throw participantError;
  }
  return data;
}

export async function markNotificationRead(notificationId) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول.");
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setPlayerPresence({ active, regionId = null, latitude = null, longitude = null, availableUntil = null }) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول لتفعيل حالة النشاط.");
  const { error } = await client.from("player_presence").upsert(
    {
      user_id: userId,
      active,
      region_id: regionId,
      latitude,
      longitude,
      available_until: availableUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  const { error: profileError } = await client
    .from("profiles")
    .update({ allow_jawk_requests: active, is_available: active, is_online: active, last_seen_at: new Date().toISOString() })
    .eq("id", userId);
  if (profileError) throw profileError;
}

export async function findPlayersWithJamJam({ matchId, maxDistanceKm = 10, limit = 5 }) {
  if (!matchId) throw new Error("لا توجد مباراة ناقصة للبحث عن لاعبين.");
  const client = requireSupabase();
  const { data, error } = await client.rpc("jamjam_matchmaker", {
    p_match_id: matchId,
    p_max_distance_km: maxDistanceKm,
    p_limit: limit,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchFazaaData() {
  const client = requireSupabase();
  const [requestsResult, playersResult, campaignResult] = await Promise.all([
    client
      .from("fazaa_requests")
      .select(
        "id,need,starts_at,match_id,match:matches(venue:venues(name)),requester:profiles(id,display_name,avatar_url)",
      )
      .eq("status", "open")
      .order("starts_at", { ascending: true })
      .limit(20),
    client
      .from("profiles")
      .select("id,display_name,avatar_url,is_online,latitude,longitude,role,rating")
      .eq("is_available", true)
      .order("last_seen_at", { ascending: false })
      .limit(20),
    client
      .from("campaigns")
      .select("id,title,subtitle,raised_amount,goal_amount")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const firstError = [requestsResult, playersResult, campaignResult].find(
    (item) => item.error,
  )?.error;
  if (firstError) throw firstError;
  return {
    fazaaRequests: (requestsResult.data ?? []).map((request) => ({
      ...request,
      pitch: request.match?.venue?.name ?? "ملعب غير مسمى",
      startsIn: formatRelativeTime(request.starts_at),
    })),
    players: (playersResult.data ?? []).map((player) => ({
      ...player,
      name: player.display_name ?? "لاعب",
      online: Boolean(player.is_online),
      distance: toArabicDistance(player.distance_meters),
    })),
    campaign: campaignResult.data
      ? {
          ...campaignResult.data,
          progress: campaignResult.data.goal_amount
            ? Math.min(
                100,
                Math.round(
                  (campaignResult.data.raised_amount / campaignResult.data.goal_amount) * 100,
                ),
              )
            : 0,
          raised: `${Number(campaignResult.data.raised_amount ?? 0).toLocaleString("ar-IQ")} د.ع`,
          goal: `${Number(campaignResult.data.goal_amount ?? 0).toLocaleString("ar-IQ")} د.ع`,
        }
      : null,
  };
}

export async function fetchProfile(userId) {
  const client = requireSupabase();
  const [profileResult, statsResult, badgesResult, gamesResult] = await Promise.all([
    client
      .from("profiles")
      .select("id,display_name,city,role,status,rating,avatar_url,allow_jawk_requests,is_available,is_online,last_seen_at")
      .eq("id", userId)
      .maybeSingle(),
    client.from("player_stats").select("games,wins,goals").eq("user_id", userId).maybeSingle(),
    client
      .from("player_badges")
      .select("id,label")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("recent_games")
      .select("id,pitch,rating,played_at")
      .eq("user_id", userId)
      .order("played_at", { ascending: false })
      .limit(10),
  ]);
  const firstError = [profileResult, statsResult, badgesResult, gamesResult].find(
    (item) => item.error,
  )?.error;
  if (firstError) throw firstError;
  const profile = profileResult.data;
  return profile
    ? {
        ...profile,
        name: profile.display_name ?? "لاعب جوك",
        role: roles.find((role) => role.id === profile.role)?.label ?? profile.role ?? "لاعب",
        status: profile.status === "radar" ? "رادار نشط" : "متاح للعب",
        presenceActive: Boolean(profile.allow_jawk_requests && profile.is_available),
        stats: [
          { id: "games", label: "لعبات", value: String(statsResult.data?.games ?? 0) },
          { id: "wins", label: "فوز", value: String(statsResult.data?.wins ?? 0) },
          { id: "goals", label: "هدف", value: String(statsResult.data?.goals ?? 0) },
        ],
        badges: badgesResult.data ?? [],
        recentGames: gamesResult.data ?? [],
      }
    : null;
}

export async function fetchRatings(matchId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("match_ratings")
    .select("id,value,player:profiles(id,display_name,avatar_url)")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((rating) => ({
    id: rating.id,
    name: rating.player?.display_name ?? "لاعب",
    value: Number(rating.value ?? 0),
    playerId: rating.player?.id,
  }));
}

export async function uploadChatAttachment(file) {
  if (!file) throw new Error("اختر ملفاً أولاً.");
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول لإرفاق ملف.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from("chat-attachments").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;
  const { data, error } = await client.storage.from("chat-attachments").createSignedUrl(path, 3600);
  if (error) throw error;
  return { url: data.signedUrl, name: file.name, type: file.type || "application/octet-stream" };
}

export async function fetchMessages(matchId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("messages")
    .select("id,body,message_type,attachment_url,attachment_name,created_at,user_id,author:profiles(display_name)")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  return (data ?? []).map((message) => ({
    id: message.id,
    author: message.author?.display_name ?? "لاعب",
    text: message.body,
    messageType: message.message_type ?? "text",
    attachmentUrl: message.attachment_url,
    attachmentName: message.attachment_name,
    time: new Date(message.created_at).toLocaleTimeString("ar-IQ", {
      hour: "numeric",
      minute: "2-digit",
    }),
    mine: message.user_id === userId,
  }));
}

export async function sendMessage({ matchId, body, attachment = null }) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول لإرسال رسالة.");
  const { error } = await client
    .from("messages")
    .insert({
      match_id: matchId,
      user_id: userId,
      body: body || attachment?.name || "مرفق",
      message_type: attachment ? (attachment.type.startsWith("image/") ? "image" : "file") : "text",
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
    });
  if (error) throw error;
}

export async function joinMatch(matchId) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول للانضمام إلى المباراة.");
  const { error } = await client
    .from("match_participants")
    .upsert(
      { match_id: matchId, user_id: userId, status: "confirmed" },
      { onConflict: "match_id,user_id" },
    );
  if (error) throw error;
}

export async function respondToFazaa(requestId) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول لإرسال الفزعة.");
  const { error } = await client
    .from("fazaa_responses")
    .upsert(
      { request_id: requestId, user_id: userId, status: "accepted" },
      { onConflict: "request_id,user_id" },
    );
  if (error) throw error;
}

export async function invitePlayer({ matchId, playerId }) {
  if (!matchId) throw new Error("لا توجد مباراة مرتبطة بهذه الدعوة.");
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول لإرسال دعوة.");
  const { error } = await client
    .from("match_invitations")
    .upsert(
      { match_id: matchId, inviter_id: userId, invitee_id: playerId, status: "pending" },
      { onConflict: "match_id,invitee_id" },
    );
  if (error) throw error;
}

export async function donate({ campaignId, amount }) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول للتبرع.");
  const { error } = await client
    .from("campaign_donations")
    .insert({ campaign_id: campaignId, user_id: userId, amount });
  if (error) throw error;
}

export async function saveRating({ matchId, playerId, value }) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("يجب تسجيل الدخول لحفظ التقييم.");
  const { error } = await client
    .from("match_ratings")
    .upsert(
      { match_id: matchId, rater_id: userId, player_id: playerId, value },
      { onConflict: "match_id,rater_id,player_id" },
    );
  if (error) throw error;
}

export async function updateProfile(userId, updates) {
  const client = requireSupabase();
  const { error } = await client.from("profiles").update(updates).eq("id", userId);
  if (error) throw error;
}
