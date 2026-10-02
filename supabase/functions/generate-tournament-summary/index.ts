import { createClient } from "npm:@supabase/supabase-js@2";
import { createResponsesCall } from "../_shared/responses.ts";
import { getLovableAiGatewayResponseHeaders } from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-lovable-aig-run-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown, headers?: HeadersInit) => new Response(JSON.stringify(body), {
  status,
  headers: getLovableAiGatewayResponseHeaders(headers, { ...corsHeaders, "Content-Type": "application/json" }),
});

const scoreSignature = (matches: Array<{ id: string; sets: unknown; winner_id: string | null; completed_at: string | null }>) =>
  matches
    .filter((match) => match.winner_id)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((match) => `${match.id}:${JSON.stringify(match.sets)}:${match.winner_id}:${match.completed_at ?? ""}`)
    .join("|");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { message: "Methode nicht erlaubt." });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json(401, { message: "Bitte erneut anmelden." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !anonKey || !apiKey) return json(500, { message: "Die AI-Funktion ist noch nicht vollständig eingerichtet." });

    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) return json(401, { message: "Die Anmeldung ist abgelaufen. Bitte erneut anmelden." });

    const body = await request.json().catch(() => null) as { tournamentId?: string } | null;
    const tournamentId = body?.tournamentId?.trim();
    if (!tournamentId) return json(400, { message: "Turnier fehlt." });

    const [{ data: tournament, error: tournamentError }, { data: matches, error: matchesError }, { data: players, error: playersError }, { data: pairs, error: pairsError }, { data: teams, error: teamsError }] = await Promise.all([
      client.from("tournaments").select("id,name,mode,type,created_by").eq("id", tournamentId).single(),
      client.from("matches").select("id,round,position,player1_id,player2_id,winner_id,sets,status,group_number,completed_at").eq("tournament_id", tournamentId).eq("status", "completed").order("round").order("position"),
      client.from("players").select("id,name,club").eq("tournament_id", tournamentId),
      client.from("doubles_pairs").select("id,player1_id,player2_id,pair_name").eq("tournament_id", tournamentId),
      client.from("teams").select("id,name").eq("tournament_id", tournamentId),
    ]);
    if (tournamentError || !tournament) return json(404, { message: "Turnier nicht gefunden." });
    if (tournament.created_by !== authData.user.id) return json(403, { message: "Nur der Turnierveranstalter darf die Zusammenfassung erstellen." });
    if (matchesError || playersError || pairsError || teamsError) return json(500, { message: "Die gespeicherten Ergebnisse konnten nicht geladen werden." });
    if (!matches?.length) return json(400, { message: "Mindestens ein abgeschlossenes Ergebnis ist erforderlich." });

    const playerMap = new Map((players ?? []).map((player) => [player.id, { name: player.name, club: player.club }]));
    const teamMap = new Map((teams ?? []).map((team) => [team.id, team.name]));
    const pairMap = new Map((pairs ?? []).map((pair) => {
      const p1 = playerMap.get(pair.player1_id);
      const p2 = playerMap.get(pair.player2_id);
      return [pair.player1_id, pair.pair_name || [p1?.name, p2?.name].filter(Boolean).join(" / ")];
    }));
    const participant = (id: string | null) => {
      if (!id) return "Freilos";
      if (tournament.type === "team") return teamMap.get(id) ?? "Unbekannt";
      if (tournament.type === "doubles") return pairMap.get(id) ?? "Unbekannt";
      const player = playerMap.get(id);
      return player ? `${player.name}${player.club ? ` (${player.club})` : ""}` : "Unbekannt";
    };
    const resultLines = matches.map((match) => {
      const sets = Array.isArray(match.sets) ? match.sets as Array<{ player1?: number; player2?: number }> : [];
      const setScore = sets.map((set) => `${set.player1 ?? 0}:${set.player2 ?? 0}`).join(", ");
      return `Runde ${match.round + 1}${match.group_number == null ? "" : `, Gruppe ${match.group_number + 1}`}: ${participant(match.player1_id)} – ${participant(match.player2_id)}; Sätze ${setScore}; Sieger: ${participant(match.winner_id)}`;
    });

    const messages = [{
      role: "user" as const,
      content: `Erstelle eine kurze, sachliche deutsche Turnierzusammenfassung für Zuschauer. Höchstens 110 Wörter, zwei kurze Absätze, keine Überschrift, keine Markdown-Aufzählung. Erwähne spannende oder klare Ergebnisse nur, wenn sie aus den Daten hervorgehen. Erfinde nichts. Das Turnier kann noch laufen; behaupte nur dann einen Gesamtsieger, wenn das eindeutig aus den Resultaten folgt.\n\nTurnier: ${tournament.name}\nModus: ${tournament.mode}\nAbgeschlossene Ergebnisse:\n${resultLines.join("\n")}`,
    }];
    const call = createResponsesCall(request, { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" }, messages);
    let content: string;
    try {
      content = (await call.result.text).trim();
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 500;
      const message = error instanceof Error ? error.message : "Die Zusammenfassung konnte nicht erstellt werden.";
      return json([400, 401, 402, 403, 429].includes(status) || status >= 500 ? status : 500, { message });
    }
    if (!content) return json(502, { message: "Das Modell hat keine Zusammenfassung geliefert." });

    const generatedAt = new Date().toISOString();
    const sourceSignature = scoreSignature(matches);
    const { error: saveError } = await client.from("tournament_summaries").upsert({
      tournament_id: tournamentId,
      content: content.slice(0, 2400),
      source_signature: sourceSignature,
      generated_at: generatedAt,
      generated_by: authData.user.id,
    }, { onConflict: "tournament_id" });
    if (saveError) return json(500, { message: "Die Zusammenfassung wurde erstellt, konnte aber nicht gespeichert werden." });

    return json(200, { content: content.slice(0, 2400), generatedAt, sourceSignature }, { "X-Lovable-AIG-Run-ID": call.result.response?.headers?.get?.("X-Lovable-AIG-Run-ID") ?? "" });
  } catch (error) {
    if (request.signal.aborted) return json(499, { message: "Erstellung abgebrochen." });
    console.error("generate-tournament-summary", error);
    return json(500, { message: "Die Zusammenfassung konnte nicht erstellt werden." });
  }
});
