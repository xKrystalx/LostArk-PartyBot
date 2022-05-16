const {SlashCommandBuilder, SlashCommandStringOption} = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('party')
    .setDescription('Creates a party.')
    .addStringOption(option => option
        .setName('description')
        .setDescription('Set a description for the new party.'))
    .addBooleanOption(option => option
        .setName('has_event')
        .setDescription('Is party using a scheduled event?'))
};