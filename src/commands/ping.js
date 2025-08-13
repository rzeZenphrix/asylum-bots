const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check latency.'),

    // Slash command
    async execute(interaction) {
        try {
            const sent = await interaction.reply({ 
                content: `${(global.emojis && global.emojis['fidgetspinner']) || ''} Calculating response time...`, 
                fetchReply: true, 
                ephemeral: true 
            });
            
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            const apiPing = Math.round(interaction.client.ws.ping);

            console.log(`✅ /ping used by ${interaction.user.tag} | Latency: ${latency}ms | API: ${apiPing}ms`);

            await interaction.followUp({ 
                content: `**Speed Report:**\n- Message latency: **${latency}ms**\n- API latency: **${apiPing}ms**\n\nNot bad, huh? ${(global.emojis && global.emojis['wink']) || ''}`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error('❌ Error in /ping command:', error);
            if (!interaction.replied) {
                await interaction.reply({ 
                    content: '⚠️ Oops! Something went wrong while running `/ping`.', 
                    ephemeral: true 
                }).catch(err => console.error('⚠️ Failed to send error message:', err));
            }
        }
    },

    // Prefix command
    async handlePrefixCommand(message, args) {
        try {
            const sent = await message.channel.send(`${(global.emojis && global.emojis['fidgetspinner']) || ''} Calculating response time...`);
            
            const latency = sent.createdTimestamp - message.createdTimestamp;
            const apiPing = Math.round(message.client.ws.ping);

            console.log(`✅ s.ping used by ${message.author.tag} | Latency: ${latency}ms | API: ${apiPing}ms`);

            await sent.edit(`**Speed Report:**\n- Message latency: **${latency}ms**\n- API latency: **${apiPing}ms**\n\nNot bad, huh? ${(global.emojis && global.emojis['wink']) || ''}`);

        } catch (error) {
            console.error('❌ Error in s.ping command:', error);
            await message.channel.send('⚠️ Oops! Something went wrong while running `s.ping`.');
        }
    }
};