// Supabase Edge Function: the trip assistant.
// Holds the Anthropic key; only authenticated travelers can invoke it; all writes go
// through validated typed tools. Deploy: supabase functions deploy assistant
// Secrets required: ANTHROPIC_API_KEY (SUPABASE_URL / keys are injected automatically).

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { TRIP, CONVENTIONS } from "./context.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const LEG_DAYS: Record<string, [number, number]> = {
  transit: [11, 12], hongkong: [13, 14], thailand: [15, 19], tokyo: [20, 24], kyoto: [25, 30],
};

const TOOLS = [
  {
    name: "add_item",
    description: "Add an activity (todo) or restaurant (eat) to the trip.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["todo", "eat"] },
        leg: { type: "string", enum: ["hongkong", "thailand", "tokyo", "kyoto"] },
        day: { type: ["integer", "null"], description: "Day of December, or null if unscheduled" },
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
    description: "List existing items, optionally filtered by leg, to check for duplicates or find one to move/delete.",
    input_schema: { type: "object", properties: { leg: { type: "string" } } },
  },
  {
    name: "move_item",
    description: "Move an existing item to a different day (or null to unschedule).",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" }, day: { type: ["integer", "null"] } },
      required: ["id"],
    },
  },
  {
    name: "delete_item",
    description: "Delete an item. Only when the user explicitly asked for that specific item.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
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

function validateItem(input: Record<string, unknown>) {
  const leg = String(input.leg);
  if (!(leg in LEG_DAYS) || leg === "transit") throw new Error(`invalid leg: ${leg}`);
  if (input.day != null) {
    const d = Number(input.day);
    const [lo, hi] = LEG_DAYS[leg];
    if (!(d >= lo && d <= hi)) throw new Error(`day ${d} is outside ${leg} (Dec ${lo}–${hi})`);
  }
  if (!["todo", "eat"].includes(String(input.kind))) throw new Error("kind must be todo|eat");
  const url = input.url == null ? null : String(input.url);
  if (url && !url.startsWith("https://")) throw new Error("url must be https");
  const ico = String(input.ico ?? "");
  if (ico.length === 0 || ico.length > 8 || /[a-zA-Z0-9]/.test(ico)) throw new Error("ico must be a single emoji");
  const note = input.note == null ? null : String(input.note).slice(0, 200);
  if (note && /[$€£¥฿]|\bTHB\b|\bUSD\b|\bJPY\b/i.test(note)) throw new Error("no prices in notes");
  return {
    kind: input.kind, leg, day: input.day ?? null, name: String(input.name).slice(0, 120),
    note, ico, lat: input.lat ?? null, lng: input.lng ?? null, url,
  };
}

// deno-lint-ignore no-explicit-any
async function runTool(name: string, input: any, db: ReturnType<typeof createClient>) {
  try {
    switch (name) {
      case "add_item": {
        const row = validateItem(input);
        const { data, error } = await db.from("items").insert(row).select().single();
        if (error) throw error;
        return { ok: true, id: data.id };
      }
      case "list_items": {
        let q = db.from("items").select("id,leg,day,kind,name,note,ico").order("day");
        if (input.leg) q = q.eq("leg", input.leg);
        const { data, error } = await q;
        if (error) throw error;
        return { ok: true, items: data };
      }
      case "move_item": {
        const { data: existing, error: e0 } = await db.from("items").select("leg").eq("id", input.id).single();
        if (e0) throw e0;
        if (input.day != null) {
          const [lo, hi] = LEG_DAYS[existing.leg];
          if (!(input.day >= lo && input.day <= hi)) throw new Error(`day outside ${existing.leg} (Dec ${lo}–${hi})`);
        }
        const { error } = await db.from("items").update({ day: input.day ?? null }).eq("id", input.id);
        if (error) throw error;
        return { ok: true };
      }
      case "delete_item": {
        const { error } = await db.from("items").delete().eq("id", input.id);
        if (error) throw error;
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
        const r = await fetch(input.url, { redirect: "follow" });
        const finalUrl = r.url;
        const html = (await r.text()).slice(0, 20000);
        const title = html.match(/<title[^>]*>([^<]{1,200})/i)?.[1] ?? null;
        const q = new URL(finalUrl).searchParams.get("q");
        return { ok: true, final_url: finalUrl, place_hint: q ?? title };
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

  // 1) Caller must be one of the two logged-in travelers.
  const authed = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // 2) Writes use the service role (RLS-independent), but only via validated tools above.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { messages } = await req.json(); // Anthropic-format messages; images arrive as base64 image blocks
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return json({ error: "bad messages" }, 400);
  }

  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
  const system = CONVENTIONS + "\n" + TRIP;
  let msgs = messages;
  const actions: unknown[] = [];

  for (let round = 0; round < 6; round++) {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-5", max_tokens: 1200, system, tools: TOOLS, messages: msgs,
    });
    const toolUses = resp.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0 || resp.stop_reason !== "tool_use") {
      const reply = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      return json({ reply, actions });
    }
    msgs = [...msgs, { role: "assistant", content: resp.content }];
    const results = [];
    for (const block of toolUses) {
      const out = await runTool(block.name, block.input, db);
      if (out.ok && ["add_item", "move_item", "delete_item"].includes(block.name)) {
        actions.push({ tool: block.name, input: block.input });
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
    }
    msgs = [...msgs, { role: "user", content: results }];
  }
  return json({ reply: "I hit my step limit — try that again in smaller pieces?", actions });
});
