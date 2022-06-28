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
    .addBooleanOption(option => option
            .setName('role_limit')
            .setDescription('(Optional) Is party role limited (ie. limit DPS to 3/4ths of a party)? (Default: No)'))
};