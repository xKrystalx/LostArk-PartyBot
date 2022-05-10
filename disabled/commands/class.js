const {SlashCommandBuilder} = require('@discordjs/builders');

const data = new SlashCommandBuilder()
    .setName('class')
    .setDescription('Manages classes.')
    .addSubcommand(subcommand => {
        subcommand
            .setName('add')
            .setDescription('Adds a new class')
            .addStringOption(option => option.setName('name').setDescription('Name of the class ie. Sorceress, Deathblade etc.'))
            .addStringOption(option => option.setName('type')
                .setRequired(true)
                .addChoice('DPS', 'dps')
                .addChoice('Support', 'support'));
    })
    .addSubcommand(subcommand => {
        subcommand
            .setName('remove')
            .setDescription('Remove a class.')
            .addStringOption(option => option.setName('name').setDescription('Name of the cllass to be deleted ie. Sorceress, Deathblade etc.'))
    });