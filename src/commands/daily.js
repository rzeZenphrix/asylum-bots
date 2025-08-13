const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../../data/daily.json');
const prefix = 's.';

function loadData() {
    if (!fs.existsSync(dataFile)) return {};
    try {
        const raw = fs.readFileSync(dataFile, 'utf8');
        if (!raw) return {};
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error parsing daily.json, resetting data file.', err);
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

async function claimDaily(user, interaction = null, channel = null) {
    const userId = user.id;
    const username = user.username;

    let db = loadData();
    if (!db[userId]) {
        db[userId] = {
            lastClaim: null,
            streak: 0,
            currency: 0,
            xp: 0,
            triviaPasses: 0
        };
    }

    const userData = db[userId];
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (userData.lastClaim === today) {
        // Next claim timestamp
        const nextClaim = new Date();
        nextClaim.setDate(nextClaim.getDate() + 1);
        const timestamp = Math.floor(nextClaim.getTime() / 1000);

        const message = `<a:timer:1405118895592837150> ${user}, you’ve already claimed your daily rewards.\n` +
                        `You can claim again <t:${timestamp}:R>!`;

        if (interaction) return interaction.reply({ content: message });
        if (channel) return channel.send(message);
        return { claimed: false, message };
    }

    let streakMessage = '';
    if (userData.lastClaim === yesterday.toDateString()) {
        userData.streak += 1;
    } else {
        if (userData.streak > 0) streakMessage = `⚠️ You missed a day! Your streak has been reset.`;
        userData.streak = 1;
    }

    // Rewards
    const multiplier = Math.pow(1.5, userData.streak - 1);
    const asylumReward = Math.floor(500 * multiplier);
    const xpReward = Math.floor(500 * multiplier);
    const triviaReward = 1;

    // Update totals
    userData.currency += asylumReward;
    userData.xp += xpReward;
    userData.triviaPasses += triviaReward;
    userData.lastClaim = today;

    saveData(db);

    console.log(`${username} claimed daily rewards | Streak: ${userData.streak}, Asylum: ${asylumReward}, XP: ${xpReward}, Trivia: ${triviaReward}`);

    const message =
        `${streakMessage ? streakMessage + '\n\n' : ''}` +
        `**Daily Rewards Claimed!**\n` +
        `-------------------------\n` +
        `<:asylum_coin:1405120064490836091>・**Asylum Coins:** ${asylumReward}\n` +
        `📚・**XP:** ${xpReward}\n` +
        `🎟・**Trivia Passes:** ${triviaReward}\n` +
        `-------------------------\n` +
        `<a:fire:1405120381374955551>・**Streak:** ${userData.streak} day(s)\n`;

    if (interaction) await interaction.reply({ content: message });
    if (channel) channel.send(message);

    return { claimed: true, message, rewards: { asylumReward, xpReward, triviaReward, streak: userData.streak } };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily rewards.'),

    async execute(interaction) {
        await claimDaily(interaction.user, interaction);
    },

    async handlePrefixCommand(message) {
        if (!message.content.startsWith(`${prefix}daily`)) return;
        await claimDaily(message.author, null, message.channel);
    },

    // Export claimDaily for reuse (e.g., birthday scheduler)
    claimDaily
};