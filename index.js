// ---- .env először! ----
require('dotenv').config();

// ---- importok ----
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const links = require('./link');       // egyszerű email->discordId tároló (Map)
const roleMap = require('./roleMap');   // variant_id -> roleId mapping

// ---- Discord kliens ----
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// Ready esemény – bot bejelentkezett
client.once('ready', async () => {
  console.log(`Discord bot bejelentkezett: ${client.user.tag}`);

  // Slash parancs regisztrálás GUILD szinten (gyorsabban megjelenik)
  const cmd = new SlashCommandBuilder()
    .setName('link')
    .setDescription('Email összekötése a Discord fiókoddal (előfizetés ellenőrzéshez).')
    .addStringOption(o => o.setName('email').setDescription('Shopify e-mailed').setRequired(true));

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
    { body: [cmd.toJSON()] }
  );
  console.log('Slash parancs regisztrálva: /link');
});

// /link parancs kezelése
client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName !== 'link') return;

  const email = i.options.getString('email')?.trim().toLowerCase();
  if (!email) return i.reply({ content: 'Adj meg egy érvényes e-mail címet!', ephemeral: true });

  links.set(email, i.user.id); // elmentjük az összerendelést
  await i.reply({ content: `Összekötve ezzel az e-maillel: **${email}** ✅`, ephemeral: true });

  const logCh = client.channels.cache.get(process.env.BOT_LOG_CHANNEL_ID);
  logCh?.send(`🔗 /link: <@${i.user.id}> ↔ ${email}`);
});

// Bot bejelentkezés
client.login(process.env.DISCORD_TOKEN);

// ---- Express szerver ----
const app = express();
app.use(express.json());

// Főoldal teszt
app.get('/', (req, res) => {
  res.send('Nutrilux server running 🚀');
});

// Seal webhook
app.post('/webhooks/seal', async (req, res) => {
  console.log('Webhook received:', req.body);
  const logCh = client.channels.cache.get(process.env.BOT_LOG_CHANNEL_ID);

  const { event, customer_email, variant_id, variants } = req.body || {};
  logCh?.send(`🧩 Webhook: **${event}** | ${customer_email || 'n/a'} | variant: ${variant_id || 'n/a'}`);

  // Itt később: email -> discordId keresés, role kiosztás/levétel
  // (most csak logolunk, hogy lásd: minden bejön)

  res.status(200).send('ok');
});

// Render miatt env PORT-ot használj!
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
