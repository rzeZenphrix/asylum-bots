const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../../data/qotd.json');
const prefix = 's.';

const defaultQuestions = [
    { id: 'q1', text: 'If you could have dinner with any historical figure, who would it be and why?' },
    { id: 'q2', text: 'What is a small habit that has changed your life for the better?' },
    { id: 'q3', text: 'Which book, movie, or game has influenced you the most?' },
    { id: 'q4', text: 'What is one skill you think everyone should learn?' },
    { id: 'q5', text: 'If you could master any language instantly, which would it be and why?' },
    { id: 'q6', text: 'What is your favorite way to unwind after a long day?' },
    { id: 'q7', text: 'What is a goal you are currently working toward?' },
    { id: 'q8', text: 'What is a place you’ve visited that you think everyone should see at least once?' },
    { id: 'q9', text: 'What’s a piece of advice you wish you had received earlier in life?' },
    { id: 'q10', text: 'If you could change one thing about modern technology, what would it be?' }
];

function ensureDataShape(db) {
    if (!db) db = {};
    if (!db.questionOfTheDay) db.questionOfTheDay = { date: null, id: null, text: null };
    if (!db.responses) db.responses = {};
    if (!db.points) db.points = {};
    if (!db.recentQuestionIds) db.recentQuestionIds = [];
    return db;
}

function loadData() {
    if (!fs.existsSync(dataFile)) return ensureDataShape({});
    try {
        const raw = fs.readFileSync(dataFile, 'utf8');
        if (!raw) return ensureDataShape({});
        return ensureDataShape(JSON.parse(raw));
    } catch (err) {
        console.error('Error parsing qotd.json, resetting data file.', err);
        return ensureDataShape({});
    }
}

function saveData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function getTodayString() {
    return new Date().toDateString();
}

function chooseQuestion(db) {
    const today = getTodayString();
    if (db.questionOfTheDay?.date === today && db.questionOfTheDay.text) {
        return db.questionOfTheDay; // already chosen for today
    }

    // Build candidate pool avoiding recentQuestionIds when possible
    const recentSet = new Set(db.recentQuestionIds || []);
    const candidates = defaultQuestions.filter(q => !recentSet.has(q.id));
    const pool = candidates.length > 0 ? candidates : defaultQuestions;

    const choice = pool[Math.floor(Math.random() * pool.length)];
    db.questionOfTheDay = { date: today, id: choice.id, text: choice.text };

    // Track recency (cap at pool size - 1 to minimize repeats until cycle)
    db.recentQuestionIds = db.recentQuestionIds || [];
    db.recentQuestionIds.push(choice.id);
    const cap = Math.max(0, defaultQuestions.length - 1);
    if (db.recentQuestionIds.length > cap) {
        db.recentQuestionIds = db.recentQuestionIds.slice(-cap);
    }

    return db.questionOfTheDay;
}

async function handleQotd(user, providedAnswer = null, interaction = null, channel = null) {
    const userId = user.id;
    const username = user.username;

    const db = loadData();
    const today = getTodayString();
    const q = chooseQuestion(db);

    db.responses[today] = db.responses[today] || {};

    if (providedAnswer === null || providedAnswer === undefined || providedAnswer === '') {
        const hasAnswered = Boolean(db.responses[today][userId]);
        const msg = `${hasAnswered ? `✅ ${username}, you have already answered today.` : `${username}, here is today’s question:`}\n` +
                    `-------------------------\n` +
                    `🗓️ ${today}\n` +
                    `❓ ${q.text}\n` +
                    `-------------------------\n` +
                    `${hasAnswered ? '' : 'Reply with `/qotd answer:<your answer>` (or `s.qotd answer <your answer>` for prefix).'}\n`;

        if (interaction) return interaction.reply({ content: msg });
        if (channel) return channel.send(msg);
        return;
    }

    // Validate one answer per user per day
    if (db.responses[today][userId]) {
        const msg = `⚠️ ${username}, you have already submitted an answer today.`;
        if (interaction) return interaction.reply({ content: msg });
        if (channel) return channel.send(msg);
        return;
    }

    const trimmed = providedAnswer.trim().slice(0, 1000);
    if (!trimmed) {
        const msg = '⚠️ Please provide a non-empty answer (max 1000 characters).';
        if (interaction) return interaction.reply({ content: msg });
        if (channel) return channel.send(msg);
        return;
    }

    // Record response
    db.responses[today][userId] = {
        answer: trimmed,
        timestamp: Date.now()
    };

    // Award participation points
    db.points[userId] = (db.points[userId] || 0) + 10;

    saveData(db);

    const msg = `✅ Thanks, ${username}! Your answer has been recorded.\n` +
                `❓ Today’s QOTD: ${q.text}\n` +
                `🏆 Points: +10 (Total: ${db.points[userId]})`;

    console.log(`${username} answered QOTD | +10 points (total ${db.points[userId]})`);

    if (interaction) return interaction.reply({ content: msg });
    if (channel) return channel.send(msg);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qotd')
        .setDescription('Question of the Day: view or answer today’s question.')
        .addStringOption(option =>
            option
                .setName('answer')
                .setDescription('Answer to today’s question (each user can answer once per day)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const providedAnswer = interaction.options.getString('answer');
        await handleQotd(interaction.user, providedAnswer, interaction);
    },

    async handlePrefixCommand(message) {
        if (!message.content.startsWith(`${prefix}qotd`)) return;
        const args = message.content.split(' ').slice(1);

        let providedAnswer = null;
        if (args[0] && args[0].toLowerCase() === 'answer') {
            providedAnswer = args.slice(1).join(' ');
        }

        await handleQotd(message.author, providedAnswer, null, message.channel);
    }
};