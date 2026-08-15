import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SKILLS = [
  'Overall','Attack','Defence','Strength','Hitpoints','Ranged','Prayer','Magic',
  'Cooking','Woodcutting','Fletching','Fishing','Firemaking','Crafting','Smithing','Mining',
  'Herblore','Agility','Thieving','Slayer','Farming','Runecrafting','Hunter','Construction','Summoning','Best Wife'
];

const SKILL_ICONS = {
  Overall: 'https://shalkith.github.io/Paul-Ville/icons/overall.gif',
  Attack: 'https://shalkith.github.io/Paul-Ville/icons/attack.gif',
  Defence: 'https://shalkith.github.io/Paul-Ville/icons/defence.gif',
  Strength: 'https://shalkith.github.io/Paul-Ville/icons/strength.gif',
  Hitpoints: 'https://shalkith.github.io/Paul-Ville/icons/hitpoints.gif',
  Ranged: 'https://shalkith.github.io/Paul-Ville/icons/ranged.gif',
  Prayer: 'https://shalkith.github.io/Paul-Ville/icons/prayer.gif',
  Magic: 'https://shalkith.github.io/Paul-Ville/icons/magic.gif',
  Cooking: 'https://shalkith.github.io/Paul-Ville/icons/cooking.gif',
  Woodcutting: 'https://shalkith.github.io/Paul-Ville/icons/woodcutting.gif',
  Fletching: 'https://shalkith.github.io/Paul-Ville/icons/fletching.gif',
  Fishing: 'https://shalkith.github.io/Paul-Ville/icons/fishing.gif',
  Firemaking: 'https://shalkith.github.io/Paul-Ville/icons/firemaking.gif',
  Crafting: 'https://shalkith.github.io/Paul-Ville/icons/crafting.gif',
  Smithing: 'https://shalkith.github.io/Paul-Ville/icons/smithing.gif',
  Mining: 'https://shalkith.github.io/Paul-Ville/icons/mining.gif',
  Herblore: 'https://shalkith.github.io/Paul-Ville/icons/herblore.gif',
  Agility: 'https://shalkith.github.io/Paul-Ville/icons/agility.gif',
  Thieving: 'https://shalkith.github.io/Paul-Ville/icons/thieving.gif',
  Slayer: 'https://shalkith.github.io/Paul-Ville/icons/slayer.gif',
  Farming: 'https://shalkith.github.io/Paul-Ville/icons/farming.gif',
  Runecrafting: 'https://shalkith.github.io/Paul-Ville/icons/runecrafting.gif',
  Hunter: 'https://shalkith.github.io/Paul-Ville/icons/hunter.gif',
  Construction: 'https://shalkith.github.io/Paul-Ville/icons/construction.gif',
  Summoning: 'https://shalkith.github.io/Paul-Ville/icons/summoning.gif',
  'Best Wife': 'https://shalkith.github.io/Paul-Ville/icons/best-wife.svg'
};

function loadEnv() {
  const candidates = [
    path.join(root, '.env'),
    path.join(__dirname, '.env'),
    path.join(root, '..', 'tools', 'discord-mod', '.env')
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnv();

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token || !guildId) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_GUILD_ID are required (via env or .env)');
  process.exit(1);
}

const hiscoresPath = path.join(root, 'data', 'hiscores.json');
if (!fs.existsSync(hiscoresPath)) {
  console.error(`Hiscores data not found at ${hiscoresPath}`);
  process.exit(1);
}

const hiscores = JSON.parse(fs.readFileSync(hiscoresPath, 'utf8'));

function skillSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 100);
}

function fmtXp(n) {
  return Number(n).toLocaleString('en-US');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function api(route, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://discord.com/api/v10${route}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    throw new Error(`Discord API ${method} ${route} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function buildLeaderboard(skillName, rows, generatedAt) {
  const isOverall = skillName === 'Overall';
  const lines = rows.map((row, i) => {
    const rank = String(i + 1).padStart(2, ' ');
    const player = row.player.slice(0, 12).padEnd(12, ' ');
    const level = String(row.level).padStart(3, ' ');
    const xp = fmtXp(row.xp).padStart(10, ' ');
    const combat = isOverall && row.combatLevel !== undefined ? ` · Combat level ${row.combatLevel}` : '';
    return `\`#${rank}\` **${player}** — Lvl ${level} • ${xp} XP${combat}`;
  });

  const header = `**${skillName} Hiscores — Top ${rows.length} players**`;
  const footer = `_Updated ${generatedAt} UTC_`;
  const content = [header, '', ...lines, '', footer].join('\n');

  // Split if it exceeds Discord's 2000-character limit
  if (content.length <= 2000) return [content];
  const chunks = [];
  let current = [header, ''];
  for (const line of lines) {
    if ((current.join('\n') + '\n' + line).length > 1900) {
      chunks.push([...current, '', footer].join('\n'));
      current = [header, '', line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 2) {
    chunks.push([...current, '', footer].join('\n'));
  }
  return chunks;
}

async function main() {
  const me = await api('/users/@me');
  console.log(`Bot: ${me.username} (${me.id})\n`);

  const guildChannels = await api(`/guilds/${guildId}/channels`);
  const channelsByName = new Map();
  for (const ch of guildChannels) {
    if (ch.type === 0) channelsByName.set(ch.name.toLowerCase(), ch);
  }

  const generatedAt = hiscores.generatedAt
    ? new Date(hiscores.generatedAt).toLocaleString('en-US', { timeZone: 'UTC' })
    : 'just now';

  const entries = Object.entries(hiscores.skills || {});
  for (const [skillId, skillData] of entries) {
    const skillName = SKILLS[Number(skillId)] || skillData.name || `Skill ${skillId}`;
    const slug = skillSlug(skillName);
    const channel = channelsByName.get(slug);

    if (!channel) {
      console.warn(`No Discord channel found for ${skillName} (#${slug})`);
      continue;
    }

    const rows = (skillData.segments?.all || skillData.rows || []).slice(0, 25);
    if (!rows.length) {
      console.warn(`No hiscore rows for ${skillName}`);
      continue;
    }

    const chunks = buildLeaderboard(skillName, rows, generatedAt);

    // Delete previous bot messages in this channel
    try {
      const messages = await api(`/channels/${channel.id}/messages?limit=50`);
      const mine = messages.filter(m => m.author.id === me.id);
      for (const m of mine) {
        await api(`/channels/${channel.id}/messages/${m.id}`, 'DELETE');
      }
    } catch (err) {
      console.warn(`Could not clean old messages in #${slug}: ${err.message}`);
    }

    // Post new leaderboard silently (suppress embeds, no @mentions)
    try {
      for (const chunk of chunks) {
        await api(`/channels/${channel.id}/messages`, 'POST', {
          content: chunk,
          allowed_mentions: { parse: [], users: [], roles: [] },
          flags: 4096 // SUPPRESS_EMBEDS
        });
      }
      console.log(`Posted ${skillName} leaderboard to #${slug}`);
    } catch (err) {
      console.error(`Failed to post ${skillName} to #${slug}: ${err.message}`);
    }

    await sleep(1100); // stay under Discord rate limits
  }

  console.log('\nHiscore leaderboard sync complete.');
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
