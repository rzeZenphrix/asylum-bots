import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import express from 'express';
import 'dotenv/config';

const PEOPLE_FILE = './people.txt';
const ASSIGNED_FILE = './assigned.txt';
const STATS_FILE = './stats.json';
const OWNER_ID = '1031115280459497472';
const GUILD_ID = process.env.GUILD_ID; 
const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.BOT_TOKEN;

// Ensure required files exist
if (!fs.existsSync(PEOPLE_FILE)) fs.writeFileSync(PEOPLE_FILE, '');
if (!fs.existsSync(ASSIGNED_FILE)) fs.writeFileSync(ASSIGNED_FILE, '');
if (!fs.existsSync(STATS_FILE)) fs.writeFileSync(STATS_FILE, '{}');

// HTTP server for UptimeRobot
const app = express();
app.get('/', (req, res) => {
  res.send('Bot is alive!');
});
app.listen(3000, () => {
  console.log('🌐 HTTP server listening on port 3000');
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
});

// Register slash command in a single guild for instant updates
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('getperson')
      .setDescription('Get a randomly assigned person to invite.')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered.');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'getperson') return;

  // Load people and assigned lists
  const allPeople = fs.readFileSync(PEOPLE_FILE, 'utf8')
    .split('\n')
    .map(id => id.trim())
    .filter(Boolean);

  const assignedPeople = fs.readFileSync(ASSIGNED_FILE, 'utf8')
    .split('\n')
    .map(id => id.trim())
    .filter(Boolean);

  // Find unassigned IDs
  const unassigned = allPeople.filter(id => !assignedPeople.includes(id));

  // Load stats
  const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));

  if (unassigned.length === 0) {
    await interaction.reply({
      content: '⚠️ No more people available for assignment.',
      ephemeral: true
    });

    // Calculate top 5 assigners
    const sorted = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let top5Text = sorted.length > 0
      ? sorted.map(([userId, count], i) => `${i + 1}. <@${userId}> — ${count} assigned`).join('\n')
      : 'No assignments recorded.';

    // DM owner
    try {
      const owner = await client.users.fetch(OWNER_ID);
      await owner.send(
        `📢 The invite list is finished — no more people to assign.\n\n🏆 **Top 5 assigners:**\n${top5Text}`
      );
    } catch (err) {
      console.error('Failed to DM owner:', err);
    }
    return;
  }

  // Pick a random unassigned ID
  const chosenID = unassigned[Math.floor(Math.random() * unassigned.length)];

  // Save to assigned.txt
  fs.appendFileSync(ASSIGNED_FILE, `${chosenID}\n`);

  // Update stats
  const userId = interaction.user.id;
  stats[userId] = (stats[userId] || 0) + 1;
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

  // Reply with clickable mention
  await interaction.reply({
    content: `✅ You have been assigned: <@${chosenID}>`,
    allowedMentions: { users: [chosenID] },
    ephemeral: true
  });

  console.log(`Assigned ${chosenID} to ${interaction.user.tag} (${unassigned.length - 1} left)`);
});

await registerCommands();
client.login(TOKEN);