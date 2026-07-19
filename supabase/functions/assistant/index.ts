// Supabase Edge Function: the trip assistant (engine edition).
// Trip structure lives in the DB; this function loads it per-request (60s cache),
// generates the model's trip context from it, and validates all writes against it.
// Deploy: supabase functions deploy assistant   Secrets: ANTHROPIC_API_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { CONVENTIONS } from "./context.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---- trip context, loaded from DB (cached briefly) ----
type Trip = {
  id: string; name: string; startDate: string; endDate: string;
  legKeys: string[]; legDays: Record<string, [number, number]>;
  summary: string;
};
let TRIP_CACHE: { at: number; trip: Trip } | null = null;

// deno-lint-ignore no-explicit-any
async function loadTrip(db: any): Promise<Trip> {
  if (TRIP_CACHE && Date.now() - TRIP_CACHE.at < 60_000) return TRIP_CACHE.trip;
  const { data: trips, error: e1 } = await db.from("trips").select("*").order("created_at").limit(1);
  if (e1 || !trips?.length) throw new Error("no trip found in database");
  const trip = trips[0];
  const [{ data: legs }, { data: days }, { data: hotels }] = await Promise.all([
    db.from("legs").select("*").eq("trip_id", trip.id).order("sort"),
    db.from("days").select("*").eq("trip_id", trip.id).order("date"),
    db.from("hotels").select("*").eq("trip_id", trip.id),
  ]);
  const legDays: Record<string, [number, number]> = {};
  for (const d of days ?? []) {
    const dn = Number(d.date.slice(8, 10));
    const cur = legDays[d.leg_key];
    legDays[d.leg_key] = cur ? [Math.min(cur[0], dn), Math.max(cur[1], dn)] : [dn, dn];
  }
  const hotelByLeg = Object.fromEntries((hotels ?? []).map((h: { leg_key: string; name: string }) => [h.leg_key, h.name]));
  const stayLegs = (legs ?? []).filter((l: { is_transit: boolean }) => !l.is_transit);
  const lines = [
    `TRIP: ${trip.name}, ${trip.start_date} to ${trip.end_date} (2 travelers).`,
    ...stayLegs.map((l: { key: string; label: string }) => {
      const [lo, hi] = legDays[l.key] ?? [0, 0];
      return `- leg "${l.key}" (${l.label}): days ${lo}-${hi} of the month. Hotel: ${hotelByLeg[l.key] ?? "TBD"}.`;
    }),
    ...(days ?? []).filter((d: { move: unknown }) => d.move).map((d: { date: string; city: string; move: { brand: string } }) =>
      `- travel day ${d.date}: ${d.city} (${d.move.brand}).`),
    `Valid legs for items: ${stayLegs.map((l: { key: string }) => l.key).join(", ")}.`,
  ];
  const t: Trip = {
    id: trip.id, name: trip.name, startDate: trip.start_date, endDate: trip.end_date,
    legKeys: stayLegs.map((l: { key: string }) => l.key), legDays, summary: lines.join("\n"),
  };
  TRIP_CACHE = { at: Date.now(), trip: t };
  return t;
}

const TOOLS = [
  {
    name: "add_item",
    description: "Add an activity (todo) or restaurant (eat) to the trip.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["todo", "eat"] },
        leg: { type: "string", description: "One of the trip's leg keys" },
        day: { type: ["integer", "null"], description: "Day of month within that leg's range, or null if unscheduled" },
        name: { type: "string" },
        note: { type: "string" },
        ico: { type: "string", description: "One matching emoji" },
        lat: { type: ["number", "null"] },
        lng: { type: ["number", "null"] },
        url: { type: ["string", "null"] },
      },
      required: ["kind", "leg", "name", "ico"],
    },
  },
  {
    name: "list_items",
    description: "List existing items, optionally filtered by leg, to check duplicates or find one to move/delete.",
    input_schema: { type: "object", properties: { leg: { type: "string" } } },
  },
  {
    name: "move_item",
    description: "Move an existing item to a different day (or null to unschedule).",
    input_schema: { type: "object", properties: { id: { type: "string" }, day: { type: ["integer", "null"] } }, required: ["id"] },
  },
  {
    name: "delete_item",
    description: "Delete an item. Only when the user explicitly asked for that specific item.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "set_hotel",
    description: "Set or replace the hotel for a leg. If that leg already has a hotel, you MUST have asked the user to confirm the replacement first.",
    input_schema: {
      type: "object",
      properties: {
        leg: { type: "string" },
        name: { type: "string" },
        lat: { type: ["number", "null"] },
        lng: { type: ["number", "null"] },
        url: { type: ["string", "null"] },
      },
      required: ["leg", "name"],
    },
  },
  {
    name: "geocode",
    description: "Look up coordinates for a place name via OpenStreetMap. Include the city, e.g. 'Ichiran Shibuya Tokyo'.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "resolve_link",
    description: "Follow a shortened link (e.g. share.google) and return the final URL and any place name found in it.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
];

function checkLegDay(trip: Trip, leg: string, day: unknown) {
  if (!trip.legKeys.includes(leg)) throw new Error(`invalid leg "${leg}" — valid: ${trip.legKeys.join(", ")}`);
  if (day != null) {
    const d = Number(day);
    const [lo, hi] = trip.legDays[leg];
    if (!(d >= lo && d <= hi)) throw new Error(`day ${d} is outside ${leg} (${lo}-${hi})`);
  }
}

function validateItem(trip: Trip, input: Record<string, unknown>) {
  checkLegDay(trip, String(input.leg), input.day);
  if (!["todo", "eat"].includes(String(input.kind))) throw new Error("kind must be todo|eat");
  const url = input.url == null ? null : String(input.url);
  if (url && !url.startsWith("https://")) throw new Error("url must be https");
  const ico = String(input.ico ?? "");
  if (ico.length === 0 || ico.length > 8 || /[a-zA-Z0-9]/.test(ico)) throw new Error("ico must be a single emoji");
  const note = input.note == null ? null : String(input.note).slice(0, 200);
  if (note && /[$€£¥฿]|\bTHB\b|\bUSD\b|\bJPY\b/i.test(note)) throw new Error("no prices in notes");
  return {
    trip_id: trip.id, kind: input.kind, leg: input.leg, day: input.day ?? null,
    name: String(input.name).slice(0, 120), note, ico, lat: input.lat ?? null, lng: input.lng ?? null, url,
  };
}

// deno-lint-ignore no-explicit-any
async function runTool(name: string, input: any, db: any, trip: Trip) {
  try {
    switch (name) {
      case "add_item": {
        const row = validateItem(trip, input);
        const { data, error } = await db.from("items").insert(row).select().single();
        if (error) throw error;
        return { ok: true, id: data.id };
      }
      case "list_items": {
        let q = db.from("items").select("id,leg,day,kind,name,note,ico").eq("trip_id", trip.id).order("day");
        if (input.leg) q = q.eq("leg", input.leg);
        const { data, error } = await q;
        if (error) throw error;
        return { ok: true, items: data };
      }
      case "move_item": {
        const { data: existing, error: e0 } = await db.from("items").select("leg").eq("id", input.id).single();
        if (e0) throw e0;
        checkLegDay(trip, existing.leg, input.day);
        const { error } = await db.from("items").update({ day: input.day ?? null }).eq("id", input.id);
        if (error) throw error;
        return { ok: true };
      }
      case "delete_item": {
        const { error } = await db.from("items").delete().eq("id", input.id);
        if (error) throw error;
        return { ok: true };
      }
      case "set_hotel": {
        if (!trip.legKeys.includes(String(input.leg))) {
          throw new Error(`invalid leg "${input.leg}" — valid: ${trip.legKeys.join(", ")}`);
        }
        const url = input.url == null ? null : String(input.url);
        if (url && !url.startsWith("https://")) throw new Error("url must be https");
        const row = {
          trip_id: trip.id, leg_key: input.leg, name: String(input.name).slice(0, 120),
          lat: input.lat ?? null, lng: input.lng ?? null, url,
        };
        const { error } = await db.from("hotels").upsert(row, { onConflict: "trip_id,leg_key" });
        if (error) throw error;
        TRIP_CACHE = null; // hotel names feed the trip summary
        return { ok: true };
      }
      case "geocode": {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(input.query)}`,
          { headers: { "User-Agent": "honeymoon-planner (personal trip app)" } },
        );
        const results = await r.json();
        return {
          ok: true,
          results: results.map((x: { display_name: string; lat: string; lon: string }) => ({
            name: x.display_name, lat: Number(x.lat), lng: Number(x.lon),
          })),
        };
      }
      case "resolve_link": {
        const r = await fetch(input.url, {
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        });
        const finalUrl = r.url;
        const html = (await r.text()).slice(0, 60000);
        const mapsPlace = finalUrl.match(/\/maps\/place\/([^/@?]+)/)?.[1];
        const q = new URL(finalUrl).searchParams.get("q");
        const og = html.match(/property=["']og:title["'][^>]*content=["']([^"']{1,200})/i)?.[1] ??
                   html.match(/content=["']([^"']{1,200})["'][^>]*property=["']og:title["']/i)?.[1];
        const title = html.match(/<title[^>]*>([^<]{1,200})/i)?.[1];
        const clean = (x: string | null | undefined) =>
          x ? decodeURIComponent(String(x).replace(/\+/g, " ")).trim() : null;
        const hint = clean(mapsPlace) ?? clean(q) ?? clean(og) ?? clean(title);
        const useless = !hint || /^google/i.test(hint) || hint.length < 3;
        return {
          ok: true, final_url: finalUrl, place_hint: useless ? null : hint,
          warning: useless ? "Could not extract a place name from this link — ask the user what the place is called. Do NOT guess." : undefined,
        };
      }
      default:
        return { ok: false, error: `unknown tool ${name}` };
    }
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authed = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const trip = await loadTrip(db);

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      return json({ error: "bad messages" }, 400);
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
    // cache_control caches the static prefix (tools + system) at ~10% read price
    const system = [{ type: "text" as const, text: CONVENTIONS + "\n" + trip.summary, cache_control: { type: "ephemeral" as const } }];
    let msgs = messages;
    const actions: unknown[] = [];

    for (let round = 0; round < 4; round++) {
      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001", max_tokens: 700, system, tools: TOOLS, messages: msgs,
      });
      const toolUses = resp.content.filter((b) => b.type === "tool_use");
      if (toolUses.length === 0 || resp.stop_reason !== "tool_use") {
        const reply = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        return json({ reply, actions });
      }
      msgs = [...msgs, { role: "assistant", content: resp.content }];
      const results = [];
      for (const block of toolUses) {
        const out = await runTool(block.name, block.input, db, trip);
        if (out.ok && ["add_item", "move_item", "delete_item", "set_hotel"].includes(block.name)) {
          actions.push({ tool: block.name, input: block.input });
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
      }
      msgs = [...msgs, { role: "user", content: results }];
    }
    return json({ reply: "I hit my step limit — try that again in smaller pieces?", actions });
  } catch (e) {
    console.error("assistant error:", e);
    return json({ error: "Assistant error: " + String((e as Error)?.message ?? e) }, 500);
  }
});
