import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import nodeCron from 'node-cron';
import db from './db.js';
import { data as linkCmd, execute as linkExec } from './commands/link.js';
import roleMap from './roleMap.js';

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; }}));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// --- Slash parancs regisztráció (egyszer futtasd) ---
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands((await client.application?.fetch())?.id || process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: [linkCmd.toJSON()] }
  );
}

// --- Helper: role grant/remove ---
async function addRoles(discordId, variantIds) {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const member = await guild.members.fetch(discordId);
  await member.roles.add(process.env.START_ROLE_ID);
  for (const v of variantIds) {
    const r = roleMap[String(v)];
    if (r) await member.roles.add(r);
  }
}

async function removeAllRoles(discordId) {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const member = await guild.members.fetch(discordId);
  await member.roles.remove([
    process.env.START_ROLE_ID,
    process.env.POWERBUILD_ROLE_ID,
    process.env.FITBURN_ROLE_ID,
    process.env.GLOWBALANCE_ROLE_ID,
    process.env.IMMUNEGUARD_ROLE_ID,
    process.env.FLEXPROTECT_ROLE_ID
  ].filter(Boolean));
}

// --- Webhook (Seal → mi) ---
app.post('/webhooks/seal', async (req, res) => {
  // ha van HMAC headered, itt tudod ellenőrizni (req.rawBody + secret)...
  try {
    const event = req.body?.event || req.body?.type || req.body?.status?.event;
    const email = (req.body?.customer_email || req.body?.customer?.email || '').toLowerCase();
    const variants = Array.isArray(req.body?.variants)
      ? req.body.variants.map(v => String(v.variant_id || v))
      : (req.body?.variant_id ? [String(req.body.variant_id)] : []);

    // email → discord_id lookup
    const link = db.prepare('SELECT discord_id FROM links WHERE email=?').get(email);
    if (!link) { return res.status(200).send('ok'); }

    if (event === 'subscription_created' || event === 'subscription_reactivated') {
      await addRoles(link.discord_id, variants);
      db.prepare('REPLACE INTO states(discord_id,status,variants,grace_until,updated_at) VALUES(?,?,?,?,?)')
        .run(link.discord_id, 'active', JSON.stringify(variants), null, Date.now());
    }
    else if (event === 'subscription_canceled' || event === 'subscription_expired') {
      await removeAllRoles(link.discord_id);
      db.prepare('REPLACE INTO states(discord_id,status,variants,grace_until,updated_at) VALUES(?,?,?,?,?)')
        .run(link.discord_id, 'canceled', '[]', null, Date.now());
    }
    else if (event === 'subscription_paused') {
      const grace = Date.now() + 7 * 24 * 60 * 60 * 1000;
      db.prepare('REPLACE INTO states(discord_id,status,variants,grace_until,updated_at) VALUES(?,?,?,?,?)')
        .run(link.discord_id, 'paused', JSON.stringify(variants), grace, Date.now());
      // szerepeket MÉG NEM vesszük el (grace)
    }
    else if (event === 'payment_failed') {
      await removeAllRoles(link.discord_id); // kérésetek szerint azonnal
      db.prepare('REPLACE INTO states(discord_id,status,variants,grace_until,updated_at) VALUES(?,?,?,?,?)')
        .run(link.discord_id, 'payment_failed', '[]', null, Date.now());
    }

    res.status(200).send('ok');
  } catch (e) {
    console.error(e);
    res.status(500).send('err');
  }
});

// --- Napi cron: grace lejárat kezelése ---
nodeCron.schedule('0 3 * * *', () => { // minden nap 03:00
  const rows = db.prepare('SELECT discord_id, grace_until FROM states WHERE status="paused" AND grace_until IS NOT NULL').all();
  const now = Date.now();
  rows.forEach(async r => {
    if (r.grace_until < now) {
      await removeAllRoles(r.discord_id);
      db.prepare('UPDATE states SET status="paused_removed", updated_at=? WHERE discord_id=?').run(Date.now(), r.discord_id);
    }
  });
});

// --- Discord bot események ---
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});
client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName === 'link') return linkExec(i);
});

// --- start ---
client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log('HTTP up'));
