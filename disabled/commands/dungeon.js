const {SlashCommandBuilder} = require('@discordjs/builders');

const data = new SlashCommandBuilder()
    .setName('partytypes')
    .setDescription('Manages party types.')
    .addSubcommand(subcommand => {
        subcommand
            .setName('add')
            .setDescription('Adds a new party type')
            .addStringOption(option => option.setName('name').setDescription('Name of the party type ie. Argos, Valtan.'))
            .addIntegerOption(option => option.setName('playercount').setDescription('Amount of players.'))
            .addStringOption(option => option.setName('stage1').setDescription('Difficulty/Checkpoint ie. Normal, Hard, Phase 1 etc. Use parameters stage# to add more.'))
            .addStringOption(option => option.setName('stage2').setDescription('Difficulty/Checkpoint ie. Normal, Hard, Phase 1 etc. Use parameters stage# to add more.'))
            .addStringOption(option => option.setName('stage3').setDescription('Difficulty/Checkpoint ie. Normal, Hard, Phase 1 etc. Use parameters stage# to add more.'))
            .addStringOption(option => option.setName('stage4').setDescription('Difficulty/Checkpoint ie. Normal, Hard, Phase 1 etc. Use parameters stage# to add more.'))
            .addStringOption(option => option.setName('stage5').setDescription('Difficulty/Checkpoint ie. Normal, Hard, Phase 1 etc. Use parameters stage# to add more.'))
            .addStringOption(option => option.setName('thumbnail').setDescription('Thumbnail url. If empty, will try to look for an image locally.'))
    })
    .addSubcommand(subcommand => {
        subcommand
            .setName('remove')
            .setDescription('Remove a party type')
            .addStringOption(option => option.setName('name').setDescription('Name of the type to be deleted ie. Argos, Valtan'))
    });