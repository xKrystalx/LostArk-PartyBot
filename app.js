require('dotenv').config();

const { channelMention } = require('@discordjs/builders');
const { InteractionType } = require('discord-api-types/v10');
// Require the necessary discord.js classes
const { Client, Intents, MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed, Permissions, Interaction, ApplicationCommand } = require('discord.js');
const { Sequelize, DataTypes } = require('sequelize');
const sequelize_fixtures = require('sequelize-fixtures');

const short_uuid = require('short-uuid');


const token = process.env.BOT_TOKEN;

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

//Setup the database
const sequelize = new Sequelize('database', process.env.DB_USERNAME, process.env.DB_PASSWORD,{
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'db/database.sqlite',
});

//Import models

//const ClassTypes = require('./models/class_types').ClassTypes;
const Classes = require('./models/classes.js')(sequelize, DataTypes);
const Dungeons = require('./models/dungeons.js')(sequelize, DataTypes);
const DungeonTypes = require('./models/dungeon_types.js')(sequelize, DataTypes);
const Parties = require('./models/parties.js')(sequelize, DataTypes);
const Players = require('./models/players.js')(sequelize, DataTypes);

//Setup relations

//ClassTypes.hasMany(Classes);
DungeonTypes.hasMany(Dungeons, {foreignKey: 'type'});
Dungeons.hasMany(Parties, {foreignKey: 'type'});
Parties.hasMany(Players, {foreignKey: 'party_id', onDelete: 'CASCADE'});
Classes.hasMany(Players, {foreignKey: 'class'});
Players.belongsTo(Classes, {foreignKey: 'class'})

// When the client is ready, run this code (only once)
client.once('ready', async () => {
    // sequelize.sync({force: true}).then(async () =>{
    //     await sequelize_fixtures.loadFile('./data/classes/*.json', {'Classes': Classes}).then(() => {
    //         console.log("[Database] Classes loaded successfully.");
    //     });
    //     await sequelize_fixtures.loadFile('./data/dungeon_types/*.json', {'DungeonTypes': DungeonTypes}).then(() => {
    //         console.log("[Database] Dungeon types loaded successfully.");
    //     });
    //     await sequelize_fixtures.loadFile('./data/dungeons/*.json', {'Dungeons': Dungeons}).then(() => {
    //         console.log("[Database] Dungeons loaded successfully.");
    //     });
        
    //     console.log('Ready!');
    // }).catch(err => console.error(err.message));

    await DungeonTypes.sync().then(async () => {
        await sequelize_fixtures.loadFile('./data/dungeon_types/*.json', {'DungeonTypes': DungeonTypes}).then(() => {
            console.log("[Database] Dungeon types loaded successfully.");
        });
    }).catch(err => console.error(err));
    await Dungeons.sync().then(async () =>{
        await sequelize_fixtures.loadFile('./data/dungeons/*.json', {'Dungeons': Dungeons}).then(() => {
            console.log("[Database] Dungeons loaded successfully.");
        });
    }).catch(err => console.error(err));
    await Classes.sync().then(async () =>{
        await sequelize_fixtures.loadFile('./data/classes/*.json', {'Classes': Classes}).then(() => {
            console.log("[Database] Classes loaded successfully.");
        });     
    }).catch(err => console.error(err));

    await Parties.sync();
    await Players.sync();

    console.log('Ready!');
});

// Login to Discord with your client's token
client.login(token);

//--------------------------------------------------------------
//--------------------------------------------------------------
//--------------------------------------------------------------

//Handle commands

client.on('interactionCreate', async interaction => {
    if(!isBotReady(client,interaction)) return;

    if(!interaction.isCommand()) return;

    if(interaction.commandName === "party"){
        const dungeons = await Dungeons.findAll().catch(err => console.error(err.message));

        //interaction.guild.emojis.cache.find(emoji => emoji.name == '');

        let options = [];
        dungeons.forEach(dungeon => {
            options.push({
                label: dungeon.name,
                description: `Lv. ${dungeon.level}+`,
                value: dungeon.name,
            })
        })

        const selectDungeons = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('dungeon')
                    .setPlaceholder('Select a dungeon...')
                    .addOptions(options)
        );

        let fields = [];
        if(interaction.options.getString('description') !== null){

            //Protect from 1024 string length error
            if(interaction.options.getString('description'.length >= 1000)){
                let embed = getErrorEmbed('Ayo, what the fuck man.');
                await interaction.reply({embeds: [embed], ephemeral: true}).catch(err => console.error(err.message));
                return;
            }
            fields = [
                // { name: '\u200b', value: '\u200b'},
                // { name: '『 Party details 』', value: '\u200b'},
                { name: 'Description', value: interaction.options.getString('description')},
                { name: '\u200b', value: '\u200b'}
            ];
        }

        const embed = new MessageEmbed()
        .setColor('#99ffff')
        .setTitle('Party')
        .setDescription('Select a dungeon from the dropdown menu below.')
        .addFields(fields)
        .setTimestamp();

        await interaction.reply({embeds: [embed], ephemeral: true, components: [selectDungeons]}).catch(err => console.error(err.message));  
    }
})

//#region Menus

client.on('interactionCreate', async interaction => {
    if(!isBotReady(client,interaction)) return;

    if(!interaction.isSelectMenu()) return;
//#region Dungeon
    if(interaction.customId === "dungeon"){

        const dungeon = await Dungeons.findOne({where: {
            name: interaction.values[0]
        }});

        const dungeonType = await DungeonTypes.findOne({where:{
            name: dungeon.type,
        }})

        if(dungeon === null){
            console.error("[Database] Dungeon not found.");
            return;
        }

        if(dungeonType === null){
            console.error("[Database] Dungeon type not found.");
            return;
        }

        const selectionEmbed = interaction.message.embeds[0].fields.find(field => field.name.toLowerCase() === "description")

        const partyData = {
            id: short_uuid.generate(),
            type: dungeon.name,
            owner_id: interaction.user.id,
            description: selectionEmbed !== undefined ?  selectionEmbed.value : "\u200b",
        }

        const party = await Parties.create(partyData);
        if(party === null){
            console.error("[Database] Failed creating a party.");
            return;
        }

        const embed = new MessageEmbed()
            .setColor(dungeon.color)
            .setTitle(dungeon.name)
            .setDescription(`${dungeon.type}`)
            .setThumbnail(dungeonType.image)
            .setImage(dungeon.image)
            .addFields(
                { name: 'Description', value: `${party.description}`, inline: false},
                { name: 'Players', value: `0 / ${dungeon.player_count}`, inline: true },
                { name: 'Rec. Level', value: `${dungeon.level}+`, inline: true},
                // { name: '\u200b', value: '―――――――――――――――――――――――――――――'},
            )
            .setTimestamp()
            .setFooter({ text: `Party ID: ${party.id}`});

        const buttons = new MessageActionRow()
            .addComponents([
                new MessageButton()
                    .setCustomId('dungeon_join')
                    .setLabel('Join')
                    .setStyle('SUCCESS'),
                
                new MessageButton()
                    .setCustomId('dungeon_leave')
                    .setLabel('Leave')
                    .setStyle('DANGER'),

                new MessageButton()
                    .setCustomId('dungeon_delete')
                    .setLabel('Delete')
                    .setStyle('SECONDARY'),
                ]
        );

        await interaction.channel.send({embeds: [embed], components: [buttons]}).catch(err => console.error(err.message));

        const embedSuccess = new MessageEmbed()
        .setColor('#66ff66')
        .setTitle('『 Success 』')
        .setDescription(`Party has been created.`)
        .setTimestamp()
        .setFooter({text: 'Nyaa'});

        await interaction.update({embeds:[embedSuccess], components:[]}).catch(err => console.error(err.message));
    }
    //#endregion
//#region Class
    if(interaction.customId === "class"){

        const footer = interaction.message.embeds[0].footer.text;
        if(footer === undefined || footer === null){
            console.error("[Party] No party ID found while handling class selection.")
        }

        //Get party id. Format: "Party ID: xxx"
        const args = footer.split(',');
        const partyId = args[0].split(':')[1].trim();
        const messageId = args[1].split(':')[1].trim();

        if(partyId === undefined){
            console.error("[Party] No party ID present while handling class selection.");
        }

        const playerData = {
            id: interaction.user.id,
            party_id: partyId,
            class: interaction.values[0]
        };

        let embed;

        //Make sure we have the message relating to the lobby
        
        const partyMessage = await interaction.channel.messages.fetch(messageId).catch(err => {
            console.error("[Party] Error fetching party message.");
            embed = getErrorEmbed("Couldn't join the party.", `Party ID: ${partyId}`);
        });

        if(partyMessage === undefined){
            await interaction.update({embeds:[embed], ephemeral: true});
            return;
        }
        //Now we can attempt to add the player to the party

        const dungeonName = interaction.message.embeds[0].fields.find(field => field.name === 'Dungeon').value;
        if(dungeonName === undefined){
            embed = getErrorEmbed("Error getting dungeon info.");
            await interaction.update({embeds:[embed], ephemeral:true});
            return;
        }
        const dungeon = await Dungeons.findOne({
            where:{
                name: dungeonName,
            }
        }).catch(async err => {
            console.error(err.message);
            embed = getErrorEmbed("Error getting dungeon info.");
            await interaction.update({embeds:[embed], ephemeral:true});
            return;
        });

        const playerClassType = await Classes.findOne({
            where:{
                name: playerData.class,
            }
        })
        if(playerClassType === null){
            let embed = getErrorEmbed(`Error fetching class data.`);
            await interaction.update({embeds:[embed], ephemeral:true}).catch(err => console.error(err.message));
            return;
        }

        const maxSupports = dungeon.player_count/4;

        if(playerClassType.type == 'Support'){
            //Check support count
            const supportCount = await Players.count({
                where:{
                    party_id: partyId,
                    '$Class.type$': 'Support',
            },
                include:[{
                    model: Classes,
                }]
            })
            //console.log(`Supports: ${supportCount} Max: ${maxSupports}`);
            if(supportCount >= maxSupports){
                //No more support slots
                let embed = getErrorEmbed(`No more support slots (Max. ${supportCount}).`);
                await interaction.update({embeds:[embed], ephemeral:true}).catch(err => console.error(err.message));
                return;
            }
        }
        else {
            //Check DPS count
            const dpsCount = await Players.count({
                where:{
                    party_id: partyId,
                    '$Class.type$': 'DPS',
            },
                include:[{
                    model: Classes,
                }]
            })
            const maxDps = dungeon.player_count - maxSupports;
            //console.log(`DPS: ${dpsCount} Max: ${maxDps}`);
            if(dpsCount >= maxDps){
                //No more support slots
                let embed = getErrorEmbed(`No more DPS slots (Max. ${dpsCount}).`);
                await interaction.update({embeds:[embed], ephemeral:true}).catch(err => console.error(err.message));
                return;
            }
        }
        const partyMember = await Players.create(playerData).catch(err => {
            console.error(err.message);
            embed = getErrorEmbed("Couldn't join the party.", `Party ID: ${partyId}`);
        });

        if(partyMember === undefined){
            await interaction.update({embeds:[embed], ephemeral: true}).catch(err => console.error(err.message));
            return;
        }

        await updatePartyMessage(partyMessage, partyId, interaction).catch(err => {
            console.error(err.message);
            partyMember.destroy();
        });

        embed = getSuccessEmbed('You have joined the party.');
        await interaction.update({embeds:[embed], components:[]}).catch(err => {
            console.error(err.message); 
            partyMember.destroy()
        });
    }
//#endregion
})
//#endregion

//#region Buttons

client.on('interactionCreate', async interaction => {
    if(!isBotReady(client,interaction)) return;

    if(!interaction.isButton()) return;
//#region Join
    if(interaction.customId == "dungeon_join"){
        const footer = interaction.message.embeds[0].footer.text;
        if(footer === undefined || footer === null){
            console.error("[Party] No party ID found while handling buttons.")
        }

        //Get party id. Format: "Party ID: xxx"
        const partyId = footer.split(':')[1].trim();

        if(partyId === undefined){
            console.error("[Party] No party ID present while handling buttons.");
        }

        const party = await Parties.findOne({
            where:{
                id: partyId,
            }
        }).catch(err => {
            console.error(err);
        })

        if(party === null){
            console.error("[Database] Party not found.");
            const embed = getErrorEmbed("Party does not exist.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err.message));
            await interaction.message.destroy();
            return;
        }

        //Check if party is full
        const partyCount = await Players.count({
            where: {
                party_id: partyId,
            }
        }).catch(err => {
            console.error(err);
        })

        const dungeon = await Dungeons.findOne({
            where: {
                name: party.type,
            }
        }).catch(err => {
            console.error(err);
        })

        //If full
        if(partyCount == dungeon.player_count){
            const embed = getErrorEmbed('Party is full.', `Party ID: ${party.id}`);

            await interaction.reply({embeds:[embed], ephemeral: true}).catch(err => console.error(err.message));
            return;
        }

        //Already in the party
        const player = await Players.findOne({
            where:{
                id: interaction.user.id,
                party_id: partyId,
            }
        });
        if(player !== null){
            let embed = getErrorEmbed("Already in the party.");
            return await interaction.reply({embeds:[embed], ephemeral:true});
        }

        //Can join
        const classes = await Classes.findAll().catch(err => console.error(err.message));

        //interaction.guild.emojis.cache.find(emoji => emoji.name == '');

        let options = [];
        classes.forEach(cls => {
            options.push({
                label: cls.name,
                description: `${cls.type}`,
                value: cls.name,
            })
        })

        const embed = new MessageEmbed()
        .setColor('#8888ff')
        .setTitle("『 Classes 』")
        .setDescription("Select your class from the dropdown menu below.")
        .addFields([
            {name: 'Dungeon', value: dungeon.name, inline: true},
            {name: 'Rec. Level', value: `${dungeon.level}+`, inline: true}
        ])
        .setTimestamp()
        .setFooter({ text: `Party ID: ${party.id}, Message ID: ${interaction.message.id}`});

        const selectClasses = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('class')
                    .setPlaceholder('Select a class...')
                    .addOptions(options)
        );

        await interaction.reply({embeds:[embed], ephemeral:true, components:[selectClasses]}).catch(err => console.error(err.message));
    }
//#endregion
//#region Leave
    if(interaction.customId == "dungeon_leave"){
        const footer = interaction.message.embeds[0].footer.text;
        if(footer === undefined || footer === null){
            console.error("[Party] No party ID found while handling buttons.")
        }

        //Get party id. Format: "Party ID: xxx"
        const partyId = footer.split(':')[1].trim();

        if(partyId === undefined){
            console.error("[Party] No party ID present while handling buttons.");
        }

        const party = await Parties.findOne({
            where:{
                id: partyId,
            }
        }).catch(err => {
            console.error(err);
        })

        if(party === null){
            console.error("[Database] Party not found.");
            const embed = getErrorEmbed("Party does not exist.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err.message));
            await interaction.message.destroy();
            return;
        }

        const player = await Players.findOne({where: {
            id: interaction.user.id,
            party_id: partyId,
        }})
        if(player === null){
            let embed = getErrorEmbed("You're not in the party.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err.message));
            return;
        }
        player.destroy();

        await updatePartyMessage(interaction.message, partyId, interaction);

        let embed = getSuccessEmbed('You have left the party.');
        await interaction.reply({embeds: [embed], ephemeral:true}).catch(err => console.error(err.message));
    }
//#endregion
//#region Delete

if(interaction.customId == "dungeon_delete"){
    let embed;
    if(!interaction.member.permissions.has([Permissions.FLAGS.MANAGE_MESSAGES])){
        embed = getErrorEmbed("Cheeky, aren't you?");
        await interaction.reply({embeds:[embed], ephemeral:true});
        return;
    }
    const footer = interaction.message.embeds[0].footer.text;
    if(footer === undefined || footer === null){
        console.error("[Party] No party ID found while handling buttons.")
    }

    //Get party id. Format: "Party ID: xxx"
    const partyId = footer.split(':')[1].trim();

    if(partyId === undefined){
        console.error("[Party] No party ID present while handling buttons.");
    }

    const party = await Parties.findOne({
        where:{
            id: partyId,
        }
    }).catch(err => {
        console.error(err);
    })
    if(party === null){
        console.error("[Database] Party not found.");
        const embed = getErrorEmbed("Couldn't delete (Party does not exist).");
        await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err.message));
        await interaction.message.destroy();
        return;
    }

    await party.destroy().then(() => {
        embed = getSuccessEmbed("Successfully deleted the party");
    }).catch(err => {
        console.error(err);
    });
    await interaction.message.delete().catch(err => console.error(err.message));
    await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err.message));
}
//#endregion
})

//#endregion

//#region Helpers
function isBotReady(client, interaction){
    if(!client.isReady){
        const embed = getErrorEmbed('Bot is not ready.');

        interaction.reply({embeds:[embed]});
        return false;
    }
    else return true;
}

function getErrorEmbed(msg, footer = 'Sad noises'){
    return new MessageEmbed()
    .setColor('#ff6666')
    .setTitle("『 Error 』")
    .setDescription(`${msg}`)
    .setTimestamp()
    .setFooter({ text: `${footer}`});
}

function getSuccessEmbed(msg, footer = 'Happy noises'){
    return new MessageEmbed()
    .setColor('#66ff66')
    .setTitle('『 Success 』')
    .setDescription(`${msg}`)
    .setTimestamp()
    .setFooter({text: `${footer}`});
}

async function updatePartyMessage(partyMessage, partyId, interaction){
    const partyEmbed = partyMessage.embeds[0];

    // const playerField = {
    //     name: '\u200B',
    //     value: `:${partyMember.class}: <@${interaction.user.id}>`
    // }

    //Get playerCount
    const countField = partyEmbed.fields.find(field => field.name.toLowerCase() === 'players');
    if(countField === undefined){
        throw EvalError("Couldn't find players field in the embed.")
    }

    const playerArgs = countField.value.split('/');
    let playerCount = parseInt(playerArgs[0].trim());
    const maxPlayers = parseInt(playerArgs[1].trim());
    playerCount += 1;

    const currentPlayers = await Players.findAll({where:{ party_id: partyId}}).catch(err => console.error(err.message));

    let fieldValue = "";

    for (const player of currentPlayers){
        const classEmoji = interaction.guild.emojis.cache.find(emoji => emoji.name === player.class);
        const playerClass = await Classes.findOne({where:{
            name: player.class,
        }});
        const isSupport = playerClass.type == 'Support' ? ' 💞' : '';
        //console.log(`${playerClass.type} == Support ${isSupport}`);
        fieldValue += `\n${classEmoji} <@${player.id}>${isSupport}`;
    };
    fieldValue.trim();

    if(fieldValue.length <= 0){
        fieldValue = '\u200b';
    }

    let field = {
        name: `Party`,
        value: `${fieldValue}`
    };

    let embed = new MessageEmbed(partyEmbed)
        .spliceFields(1, 1,{
            name: 'Players',
            value: `${currentPlayers.length} / ${maxPlayers}`,
            inline: true,
        })
        .spliceFields(3, 1, field);

    partyMessage.edit({embeds:[embed]});
}
//#endregion