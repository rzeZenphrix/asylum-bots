const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../../data/birthdays.json');
const prefix = 's.';

function loadData() {
    if (!fs.existsSync(dataFile)) return {};
    try {
        const raw = fs.readFileSync(dataFile, 'utf8');
        if (!raw) return {};
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error parsing birthdays.json, resetting data file.', err);
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

async function setBirthday(user, date, interaction = null, channel = null) {
    const userId = user.id;
    const username = user.username;

    // Validate date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const msg = '⚠️ Invalid date format! Please use YYYY-MM-DD.';
        if (interaction) return interaction.reply({ content: msg });
        if (channel) return channel.send(msg);
        return;
    }

    const db = loadData();

    if (db[userId]) {
        const msg = `⚠️ ${username}, your birthday has already been set and cannot be changed.`;
        if (interaction) return interaction.reply({ content: msg });
        if (channel) return channel.send(msg);
        return;
    }

    const [year, month, day] = date.split('-').map(Number);
    db[userId] = { year, month, day };
    saveData(db);

    const now = new Date();
    let message = `${username}, your birthday has been set to **${date}**!`;

    // Optional: Happy birthday if today
    if (now.getMonth() + 1 === month && now.getDate() === day) {
        message = `${(global.emojis && global.emojis['spinningcake']) || ''} Happy Birthday, ${username}! 🎉\n` +
                  `-------------------------\n-# Till next year~`;
    }

    console.log(`✅ Birthday set for ${username}: ${date}`);
    if (interaction) return interaction.reply({ content: message });
    if (channel) return channel.send(message);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Set your birthday!')
        .addStringOption(option =>
            option.setName('date')
                  .setDescription('Your birthday in YYYY-MM-DD format')
                  .setRequired(true)
        ),

    async execute(interaction) {
        const date = interaction.options.getString('date');
        await setBirthday(interaction.user, date, interaction);
    },

    async handlePrefixCommand(message) {
        if (!message.content.startsWith(`${prefix}birthday`)) return;
        const args = message.content.split(' ').slice(1);
        if (!args[0]) return message.channel.send('⚠️ Please provide your birthday in YYYY-MM-DD format.');
        await setBirthday(message.author, args[0], null, message.channel);
    }
};
