const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes, Events } = require('discord.js');
require('dotenv').config();

const prefix = 's.';

// === Client Setup ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();

// === Load Commands ===
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];
console.log(`📂 Found ${commandFiles.length} command file(s). Loading...`);

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
        console.warn(`⚠️ Skipped ${file} — missing "data" or "execute" property.`);
    }
}

// === Register Slash Commands ===
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('📡 Registering commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log(`Successfully registered ${commands.length} command(s) to guild`);
    } catch (error) {
        console.error('Error registering commands:', error.stack || error);
    }
})();

// === Events ===
client.once(Events.ClientReady, c => {
    console.log(`Successfully logged in as ${c.user.tag}`);
});

// Slash commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command found for ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error.stack || error);
        if (!interaction.replied) {
            await interaction.reply({
                content: '⚠️ There was an error while executing this command!',
                ephemeral: true
            }).catch(err => console.error('⚠️ Failed to send error message:', err.stack || err));
        }
    }
});

// === Prefix Commands ===
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command || !command.handlePrefixCommand) return;

    try {
        await command.handlePrefixCommand(message, args);
    } catch (err) {
        console.error(`Error executing prefix command ${commandName}:`, err.stack || err);
        message.reply('⚠️ There was an error while executing this command.');
    }
});

// === Login ===
client.login(process.env.TOKEN)
    .then(() => console.log('Starting...'))
    .catch(err => console.error('Failed to log in:', err.stack || err));