const fs = require('fs');
const path = require('path');

const birthdaysFile = path.join(__dirname, '../../data/birthdays.json');
const dailyDataFile = path.join(__dirname, '../../data/daily.json');

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw) return {};
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Error parsing ${path.basename(filePath)}. Resetting file.`, err);
        return {};
    }
}

function getTodayMonthDay() {
    const now = new Date();
    return { month: now.getMonth() + 1, day: now.getDate(), todayString: now.toDateString() };
}

async function runBirthdayJob(client) {
    const birthdays = loadJson(birthdaysFile);
    const { month: todayMonth, day: todayDay, todayString } = getTodayMonthDay();

    const daily = require('../commands/daily');

    for (const userId of Object.keys(birthdays)) {
        const { month, day } = birthdays[userId];
        if (month !== todayMonth || day !== todayDay) continue;

        try {
            const user = await client.users.fetch(userId);
            if (!user) continue;

            // Check if already claimed today
            const beforeDailyDb = loadJson(dailyDataFile);
            const beforeClaimed = beforeDailyDb[userId]?.lastClaim === todayString;

            // Attempt to claim daily automatically
            let autoClaimed = false;
            try {
                const result = await daily.claimDaily(user);
                autoClaimed = Boolean(result && result.claimed && !beforeClaimed);
            } catch (err) {
                console.error(`Failed to auto-claim daily for ${user.username} (${userId})`, err);
            }

            const baseMessage = `<a:spinningcake:1405132228823875637> Happy Birthday, ${user.username}! 🎉\n` +
                `-------------------------\n` +
                `${autoClaimed ? '🎁 Your daily rewards have been automatically claimed as a birthday treat!\n' : ''}` +
                `-# Till next year~`;

            await user.send({ content: baseMessage }).catch(() => {});
        } catch (err) {
            console.error(`Error processing birthday for user ${userId}:`, err);
        }
    }
}

function scheduleNextMidnight(callback) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0); // Next midnight
    const delayMs = next.getTime() - now.getTime();
    setTimeout(async () => {
        try {
            await callback();
        } finally {
            scheduleNextMidnight(callback);
        }
    }, delayMs);
}

function initBirthdayScheduler(client) {
    // Run once on startup for the current day
    runBirthdayJob(client).catch(err => console.error('Birthday job failed on startup:', err));

    // Then schedule to run at every next midnight
    scheduleNextMidnight(() => runBirthdayJob(client));
}

module.exports = { initBirthdayScheduler };