const fs = require('fs');
const path = require('path');

const emojisTxtPath = path.join(__dirname, '../../emojis.txt');

function parseEmojisTxt(content) {
    const map = {};
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
        const [rawName, rawId, rawAnimated] = line.split(',').map(s => (s || '').trim());
        if (!rawName || !rawId) continue;
        const name = rawName.toLowerCase();
        const id = rawId;
        const animated = String(rawAnimated || '').toLowerCase() === 'true';
        const tag = animated ? `<a:${name}:${id}>` : `<:${name}:${id}>`;
        map[name] = tag;
    }
    return map;
}

function initEmojis() {
    try {
        if (!fs.existsSync(emojisTxtPath)) {
            global.emojis = {};
            return;
        }
        const raw = fs.readFileSync(emojisTxtPath, 'utf8');
        global.emojis = parseEmojisTxt(raw);
        console.log(`✅ Loaded ${Object.keys(global.emojis).length} custom emoji(s).`);
    } catch (err) {
        console.error('Failed to load emojis.txt:', err);
        global.emojis = {};
    }
}

module.exports = { initEmojis };