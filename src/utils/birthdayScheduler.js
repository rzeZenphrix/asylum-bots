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

    // Try to resolve birthday channel once per run
    const birthdayChannelId = process.env.BIRTHDAY_CHANNEL_ID;
    let birthdayChannel = null;
    if (birthdayChannelId) {
        try {
            birthdayChannel = await client.channels.fetch(birthdayChannelId);
        } catch (err) {
            console.error('Failed to fetch BIRTHDAY_CHANNEL_ID channel:', err);
        }
    }

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

            const content = `<a:spinningcake:1405132228823875637> Happy Birthday, <@${userId}>! 🎉\n` +
                `-------------------------\n` +
                `${autoClaimed ? '🎁 Your daily rewards have been automatically claimed as a birthday treat!\n' : ''}` +
                `-# Till next year~`;

            let sent = false;
            if (birthdayChannel) {
                try {
                    await birthdayChannel.send({ content });
                    sent = true;
                } catch (err) {
                    console.error('Failed to send birthday message to channel, will try DM:', err);
                }
            }

            if (!sent) {
                await user.send({ content }).catch(() => {});
            }
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