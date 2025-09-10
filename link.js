import { SlashCommandBuilder } from 'discord.js';
import db from '../db.js';
import { getActiveSubsByEmail } from '../sealClient.js';
import roleMap from '../roleMap.js';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link your email to verify Nutrilux subscription.')
  .addStringOption(o => o.setName('email').setDescription('Your shop email').setRequired(true));

export async function execute(interaction) {
  const email = interaction.options.getString('email').trim().toLowerCase();
  await interaction.deferReply({ ephemeral: true });

  // elmented a linket
  db.prepare('REPLACE INTO links(discord_id,email,created_at) VALUES(?,?,?)')
    .run(interaction.user.id, email, Date.now());

  // lekérdezés
  const variants = await getActiveSubsByEmail(email);

  if (!variants.length) {
    await interaction.editReply('No active subscription found for this email.');
    return;
  }

  const guild = await interaction.client.guilds.fetch(process.env.GUILD_ID);
  const member = await guild.members.fetch(interaction.user.id);

  // Start role
  await member.roles.add(process.env.START_ROLE_ID);

  // Variáns szerepek
  for (const variantId of variants) {
    const roleId = roleMap[variantId];
    if (roleId) await member.roles.add(roleId);
  }

  // állapot mentés
  db.prepare('REPLACE INTO states(discord_id,status,variants,grace_until,updated_at) VALUES(?,?,?,?,?)')
    .run(interaction.user.id, 'active', JSON.stringify(variants), null, Date.now());

  await interaction.editReply('Verified. Roles assigned ✅');
}