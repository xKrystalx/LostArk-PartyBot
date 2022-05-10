const {SlashCommandBuilder, SlashCommandStringOption} = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('party')
    .setDescription('Creates a party.')
    .addStringOption(option => option
        .setName('description')
        .setDescription('Set a description for the new party.'))
};