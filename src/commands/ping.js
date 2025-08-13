const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check latency.'),
        
    async execute(interaction) {
        try {
            const sent = await interaction.reply({ 
                content: '<a:fidgetspinner:1405112906781298749> Calculating response time...', 
                fetchReply: true, 
                ephemeral: true 
            });
            
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            const apiPing = Math.round(interaction.client.ws.ping);

            console.log(`✅ /ping used by ${interaction.user.tag} | Latency: ${latency}ms | API: ${apiPing}ms`);

            await interaction.followUp({ 
                content: `**Speed Report:**\n- Message latency: **${latency}ms**\n- API latency: **${apiPing}ms**\n\nNot bad, huh? <:wink:1405110756692721725>`, 
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
    }
};