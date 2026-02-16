import { Client, GatewayIntentBits, TextChannel } from "discord.js";

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const MC_API_BASE = process.env.MC_API_BASE ?? "http://127.0.0.1:3001";
const MC_OPERATOR_KEY = process.env.MC_OPERATOR_KEY;
const CHANNELS = (process.env.DISCORD_BRIDGED_CHANNELS ??
  "research-intel,research,company-policy,policy,sales-enable,sales,ops-reliability,ops")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

if (!DISCORD_BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN is required");
}
if (!MC_OPERATOR_KEY) {
  throw new Error("MC_OPERATOR_KEY is required");
}
const BRIDGE_KEY: string = MC_OPERATOR_KEY;

type BridgeResponse = {
  ignored?: boolean;
  mode?: string;
  message?: string;
  notePath?: string;
  answer?: string;
  sources?: string[];
};

async function callBridge(payload: {
  channel_name: string;
  content: string;
  author_username: string;
  author_id: string;
  message_id: string;
  timestamp: string;
}): Promise<BridgeResponse> {
  const res = await fetch(`${MC_API_BASE}/api/discord/bridge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mc-key": BRIDGE_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`bridge call failed ${res.status}: ${text}`);
  }

  return (await res.json()) as BridgeResponse;
}

async function syncAgents(payload: Array<{ requester: string; requesterId: string; channel: string }>) {
  const res = await fetch(`${MC_API_BASE}/api/discord/sync-agents`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mc-key": BRIDGE_KEY,
    },
    body: JSON.stringify({ agents: payload }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sync-agents failed ${res.status}: ${text}`);
  }

  return (await res.json()) as { ok: boolean; count: number };
}

function formatReply(result: BridgeResponse): string | null {
  if (result.ignored) return null;

  if (result.mode?.includes("intake")) {
    return [
      `Task accepted.`,
      result.message ? result.message : null,
      result.notePath ? `Note: ${result.notePath}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (result.mode?.includes("lookup")) {
    return [
      result.answer ?? "No result.",
      result.sources && result.sources.length > 0
        ? `Sources:\n${result.sources.map((s) => `- ${s}`).join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return result.message ?? result.answer ?? null;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", async () => {
  // eslint-disable-next-line no-console
  console.log(`[discord-bridge-bot] ready as ${client.user?.tag}`);

  try {
    const found = new Map<string, { requester: string; requesterId: string; channel: string }>();

    for (const guild of client.guilds.cache.values()) {
      const channels = await guild.channels.fetch();
      for (const ch of channels.values()) {
        if (!ch || !ch.isTextBased() || !("name" in ch)) continue;
        const channelName = ch.name?.toLowerCase?.() ?? "";
        if (!CHANNELS.includes(channelName)) continue;

        const messages = await (ch as TextChannel).messages.fetch({ limit: 100 });
        for (const m of messages.values()) {
          if (m.author.bot) continue;
          const key = `${m.author.id}:${channelName}`;
          if (!found.has(key)) {
            found.set(key, {
              requester: m.author.username,
              requesterId: m.author.id,
              channel: channelName,
            });
          }
        }
      }
    }

    if (found.size > 0) {
      const result = await syncAgents([...found.values()]);
      // eslint-disable-next-line no-console
      console.log(`[discord-bridge-bot] synced agents from history: ${result.count}`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[discord-bridge-bot] initial sync error", err);
  }
});

client.on("messageCreate", async (msg) => {
  try {
    if (msg.author.bot) return;
    if (!msg.guild) return;

    const channel = msg.channel as TextChannel;
    const channelName = channel.name?.toLowerCase?.() ?? "";

    if (!CHANNELS.includes(channelName)) return;
    if (!msg.content?.trim()) return;

    const result = await callBridge({
      channel_name: channelName,
      content: msg.content,
      author_username: msg.author.username,
      author_id: msg.author.id,
      message_id: msg.id,
      timestamp: msg.createdAt.toISOString(),
    });

    const reply = formatReply(result);
    if (reply) await msg.reply(reply.slice(0, 1900));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[discord-bridge-bot] message handler error", err);
  }
});

client.login(DISCORD_BOT_TOKEN);
