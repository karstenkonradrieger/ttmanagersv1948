import { createClient } from "npm:@supabase/supabase-js@2";
import type { ModelMessage, UIMessage } from "npm:ai";
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

const textFromMessage = (message: UIMessage | undefined) => message?.parts
  ?.filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text")
  .map((part) => part.text)
  .join("")
  .trim() ?? "";

const safeStatus = (error: unknown) => {
  const status = typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode?: number }).statusCode)
    : 500;
  return [400, 401, 402, 403, 429].includes(status) || status >= 500 ? status : 500;
};

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

    const body = await request.json().catch(() => null) as { tournamentId?: string; messages?: UIMessage[] } | null;
    const tournamentId = body?.tournamentId?.trim();
    const question = textFromMessage(body?.messages?.at(-1));
    if (!tournamentId) return json(400, { message: "Turnier fehlt." });
    if (!question) return json(400, { message: "Bitte eine Frage eingeben." });
    if (question.length > 1200) return json(400, { message: "Die Frage darf höchstens 1.200 Zeichen lang sein." });

    const [{ data: tournament, error: tournamentError }, { data: matches, error: matchesError }, { data: players, error: playersError }, { data: pairs, error: pairsError }, { data: teams, error: teamsError }, { data: history, error: historyError }] = await Promise.all([
      client.from("tournaments").select("id,name,mode,type,phase,started,created_by").eq("id", tournamentId).single(),
      client.from("matches").select("id,round,position,player1_id,player2_id,winner_id,sets,status,group_number,completed_at,home_team_id,away_team_id").eq("tournament_id", tournamentId).order("round").order("position"),
      client.from("players").select("id,name,club").eq("tournament_id", tournamentId),
      client.from("doubles_pairs").select("id,player1_id,player2_id,pair_name").eq("tournament_id", tournamentId),
      client.from("teams").select("id,name").eq("tournament_id", tournamentId),
      client.from("tournament_chat_messages").select("role,content,created_at").eq("tournament_id", tournamentId).order("created_at").limit(40),
    ]);
    if (tournamentError || !tournament) return json(404, { message: "Turnier nicht gefunden." });
    if (tournament.created_by !== authData.user.id) return json(403, { message: "Nur der Turnierveranstalter darf Fragen zu diesem Turnier stellen." });
    if (matchesError || playersError || pairsError || teamsError || historyError) return json(500, { message: "Die gespeicherten Turnierdaten konnten nicht geladen werden." });

    const matchIds = (matches ?? []).map((match) => match.id);
    const { data: encounterGames, error: encounterError } = matchIds.length
      ? await client.from("encounter_games").select("match_id,game_number,game_type,home_player1_id,home_player2_id,away_player1_id,away_player2_id,sets,winner_side,status").in("match_id", matchIds).order("game_number")
      : { data: [], error: null };
    if (encounterError) return json(500, { message: "Die Mannschaftsergebnisse konnten nicht geladen werden." });

    const playerMap = new Map((players ?? []).map((player) => [player.id, `${player.name}${player.club ? ` (${player.club})` : ""}`]));
    const teamMap = new Map((teams ?? []).map((team) => [team.id, team.name]));
    const pairMap = new Map((pairs ?? []).map((pair) => [pair.player1_id, pair.pair_name || [playerMap.get(pair.player1_id), playerMap.get(pair.player2_id)].filter(Boolean).join(" / ")]));
    const participant = (id: string | null, teamId?: string | null) => {
      if (teamId) return teamMap.get(teamId) ?? "Unbekanntes Team";
      if (!id) return "Freilos";
      if (tournament.type === "doubles") return pairMap.get(id) ?? "Unbekanntes Doppel";
      return playerMap.get(id) ?? "Unbekannt";
    };
    const formatSets = (sets: unknown) => Array.isArray(sets)
      ? (sets as Array<{ player1?: number; player2?: number }>).map((set) => `${set.player1 ?? 0}:${set.player2 ?? 0}`).join(", ") || "keine"
      : "keine";
    const matchLines = (matches ?? []).map((match) =>
      `Spiel ${match.id}: Runde ${match.round + 1}${match.group_number == null ? "" : `, Gruppe ${match.group_number + 1}`}; ${participant(match.player1_id, match.home_team_id)} – ${participant(match.player2_id, match.away_team_id)}; Status ${match.status}; Sätze ${formatSets(match.sets)}; Sieger ${participant(match.winner_id)}`
    );
    const encounterLines = (encounterGames ?? []).map((game) => {
      const home = [game.home_player1_id, game.home_player2_id].filter(Boolean).map((id) => playerMap.get(id as string) ?? "Unbekannt").join(" / ");
      const away = [game.away_player1_id, game.away_player2_id].filter(Boolean).map((id) => playerMap.get(id as string) ?? "Unbekannt").join(" / ");
      return `Mannschaftsspiel ${game.match_id}, Einzel ${game.game_number}: ${home} – ${away}; Status ${game.status}; Sätze ${formatSets(game.sets)}; Siegerseite ${game.winner_side ?? "offen"}`;
    });
    const dataContext = `Turnier: ${tournament.name}\nModus: ${tournament.mode}\nTyp: ${tournament.type}\nPhase: ${tournament.phase ?? "keine"}\nGestartet: ${tournament.started ? "ja" : "nein"}\n\nSpiele:\n${matchLines.join("\n") || "Noch keine Spiele gespeichert."}\n\nMannschafts-Einzelbegegnungen:\n${encounterLines.join("\n") || "Keine gespeichert."}`;

    const modelMessages: ModelMessage[] = [
      { role: "system", content: "Du beantwortest auf Deutsch Fragen eines Turnierveranstalters. Nutze ausschließlich die mitgelieferten aktuellen Turnierdaten. Erfinde keine Ergebnisse, Namen oder Zusammenhänge. Wenn die Daten nicht reichen, sage das klar. Antworte kurz, sachlich und gut teilbar. Gib keine privaten Kontaktdaten aus." },
      { role: "user", content: `Aktueller Turnierdatenstand:\n${dataContext}` },
      ...(history ?? []).map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
      { role: "user", content: question },
    ];

    const originalMessages: UIMessage[] = (body?.messages ?? []).slice(-40);
    const call = createResponsesCall(request, { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" }, modelMessages, {
      originalMessages,
      onEnd: async ({ messages, isAborted, outcome }) => {
        if (isAborted || outcome.status !== "success") return;
        const answer = textFromMessage(messages.at(-1)).slice(0, 8000);
        if (!answer) throw new Error("Das Modell hat keine Antwort geliefert.");
        const { error: saveError } = await client.from("tournament_chat_messages").insert([
          { tournament_id: tournamentId, role: "user", content: question, created_by: authData.user.id },
          { tournament_id: tournamentId, role: "assistant", content: answer, created_by: authData.user.id },
        ]);
        if (saveError) throw new Error("Die Antwort wurde erstellt, konnte aber nicht gespeichert werden.");
      },
    });
    return await call.response(corsHeaders);
  } catch (error) {
    if (request.signal.aborted) return json(499, { message: "Antwort abgebrochen." });
    console.error("ask-tournament", error);
    return json(safeStatus(error), { message: error instanceof Error ? error.message : "Die Frage konnte nicht beantwortet werden." });
  }
});
