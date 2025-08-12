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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers],
});

// Register slash commands in a single guild
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('getperson')
      .setDescription('Get a randomly assigned person to invite.'),

    new SlashCommandBuilder()
      .setName('myassigned')
      .setDescription('View all the people that have been assigned to you.')
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

  // Load data
  const allPeople = fs.readFileSync(PEOPLE_FILE, 'utf8')
    .split('\n')
    .map(id => id.trim())
    .filter(Boolean);

  const assignedPeople = fs.readFileSync(ASSIGNED_FILE, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));

  if (interaction.commandName === 'getperson') {
    const unassigned = allPeople.filter(id => !assignedPeople.some(ap => ap.split(':')[1] === id));

    if (unassigned.length === 0) {
      await interaction.reply({
        content: '⚠️ No more people available for assignment.',
        ephemeral: true
      });

      const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
      const top5 = sorted.slice(0, 5);

      let top5Text = top5.length > 0
        ? top5.map(([userId, count], i) => `${i + 1}. <@${userId}> — ${count} assigned`).join('\n')
        : 'No assignments recorded.';

      let fullListText = sorted.length > 0
        ? sorted.map(([userId, count]) => `<@${userId}> — ${count}`).join('\n')
        : 'No assignments recorded.';

      try {
        const owner = await client.users.fetch(OWNER_ID);
        await owner.send(
          `📢 The invite list is finished — no more people to assign.\n\n🏆 **Top 5 assigners:**\n${top5Text}\n\n📋 **Full participant list:**\n${fullListText}`
        );
      } catch (err) {
        console.error('Failed to DM owner:', err);
      }
      return;
    }

    // Pick random unassigned
    const chosenID = unassigned[Math.floor(Math.random() * unassigned.length)];

    // Get username
    let chosenUser;
    try {
      chosenUser = await client.users.fetch(chosenID);
    } catch {
      chosenUser = { username: 'Unknown User', id: chosenID };
    }

    // Save to assigned.txt in format: assignerID:assignedID
    fs.appendFileSync(ASSIGNED_FILE, `${interaction.user.id}:${chosenID}\n`);

    // Update stats
    stats[interaction.user.id] = (stats[interaction.user.id] || 0) + 1;
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

    // Reply with mention + username
    await interaction.reply({
      content: `✅ You have been assigned: <@${chosenID}> (${chosenUser.username})`,
      allowedMentions: { users: [chosenID] },
      ephemeral: true
    });

    console.log(`Assigned ${chosenID} (${chosenUser.username}) to ${interaction.user.tag} (${unassigned.length - 1} left)`);
  }

  if (interaction.commandName === 'myassigned') {
    const myAssigned = assignedPeople
      .filter(line => line.split(':')[0] === interaction.user.id)
      .map(line => line.split(':')[1]);

    if (myAssigned.length === 0) {
      await interaction.reply({
        content: 'ℹ️ You haven’t been assigned anyone yet.',
        ephemeral: true
      });
      return;
    }

    // Fetch usernames for all assigned
    const displayList = await Promise.all(myAssigned.map(async id => {
      try {
        const user = await client.users.fetch(id);
        return `<@${id}> (${user.username})`;
      } catch {
        return `<@${id}> (Unknown User)`;
      }
    }));

    await interaction.reply({
      content: `📋 People assigned to you:\n${displayList.join('\n')}`,
      ephemeral: true
    });
  }
});

await registerCommands();
client.login(TOKEN);