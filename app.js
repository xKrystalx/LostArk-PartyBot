require('dotenv').config();

const { channelMention, SelectMenuBuilder } = require('@discordjs/builders');
const { InteractionType } = require('discord-api-types/v10');
// Require the necessary discord.js classes
const { Client, Intents, MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed, Permissions, Interaction, ApplicationCommand } = require('discord.js');
const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');

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
    //Load dungeon types
    await DungeonTypes.sync().then(async () => {
        let array = await parseJsonArrays('./data/dungeon_types/').catch(err => {
            console.error(err);
            return [];
        });
        if(array.length <= 0){
            return;
        }

        //Update on change (but avoid changing the name which is the primary key)
        await DungeonTypes.bulkCreate(array, {
            updateOnDuplicate: Object.keys(array[0]).filter(key => key !== 'name'),
        }).then(() => {
            console.log("[Database] Dungeon types loaded successfully.");
        });
    }).catch(err => console.error(err));

    //Load dungeons
    await Dungeons.sync().then(async () =>{
        let array = await parseJsonArrays('./data/dungeons/').catch(err => {
            console.error(err);
            return [];
        });
        if(array.length <= 0){
            return;
        }
        await Dungeons.bulkCreate(array, {
            updateOnDuplicate: Object.keys(array[0]).filter(key => key !== 'name'),
        }).then(() => {
            console.log("[Database] Dungeons loaded successfully.");
        });
    }).catch(err => console.error(err));

    //Load classes
    await Classes.sync().then(async () =>{
        let array = await parseJsonArrays('./data/classes/').catch(err => {
            console.error(err);
            return [];
        });
        if(array.length <= 0){
            return;
        }
        await Classes.bulkCreate(array, {
            updateOnDuplicate: Object.keys(array[0]).filter(key => key !== 'name')
        }).then(() => {
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
        let fields = [];
        let description = "";
        if(interaction.options.getString('description') != null){
            description = interaction.options.getString('description');
            //Protect from 1024 string length error
            if(interaction.options.getString('description'.length >= 1000)){
                let embed = getErrorEmbed('Ayo, what the fuck man.');
                await interaction.reply({embeds: [embed], ephemeral: true}).catch(err => console.error(err));
                return;
            }
            fields = [
                // { name: '\u200b', value: '\u200b'},
                // { name: '『 Party details 』', value: '\u200b'},
                { name: 'Description', value: description, inline: true},
            ];
        }

        if(interaction.options.getBoolean('role_limit') != null){
            role_limit = interaction.options.getBoolean('role_limit');
            fields.push({
                name: 'Role Limit',
                value: interaction.options.getBoolean('role_limit').toString(),
                inline: true,
            })
        }

        //Check if bot can send a message here
        if(!interaction.channel.permissionsFor(interaction.guild.me).has([Permissions.FLAGS.SEND_MESSAGES])){
            let embed = getErrorEmbed("Missing permissions: [Send Messages]");
            await interaction.reply({embeds: [embed], ephemeral:true}).catch(err => console.error(err));
            return;
        }

        if(!interaction.channel.viewable){
            let embed = getErrorEmbed("No access to the channel.");
            await interaction.reply({embeds: [embed], ephemeral:true}).catch(err => console.error(err));
            return;
        }

        const embed = new MessageEmbed()
        .setColor('#99ffff')
        .setTitle('Party')
        .setDescription('Select an associated event from the dropdown menu below.')
        .addFields(fields)
        .setTimestamp();

        let component;
        if(interaction.options.getBoolean('has_event')){
            const scheduledEvents = await interaction.guild.scheduledEvents.fetch();
            if(scheduledEvents == null){
                await sendDungeonMenu(interaction, fields).catch(err => console.error(err));
                return;
            }
            let options = [];
            scheduledEvents.each(event => {
                options.push({
                    label: event.name,
                    description: `Scheduled for: ${event.scheduledStartAt.toUTCString()}`,
                    value: event.url,
                })
            });
            const eventComponent = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('dungeon_event')
                    .setPlaceholder('Select the associated event...')
                    .addOptions(options)
            );
            await interaction.reply({embeds: [embed], ephemeral: true, components: [eventComponent]}).catch(err => console.error(err)); 
            return;
        }
        else{
            await sendDungeonMenu(interaction, fields).catch(err => console.error(err));
            return;
        }
    }
})

//#region Menus

client.on('interactionCreate', async interaction => {
    if(!isBotReady(client,interaction)) return;

    if(!interaction.isSelectMenu()) return;
//#region Event
    if(interaction.customId === "dungeon_event"){

        let description = interaction.message.embeds[0].fields.find(field => field.name.toLowerCase() === 'description');
        let role_limit = interaction.message.embeds[0].fields.find(field => field.name.toLowerCase() === 'role limit');

        let fields = [];

        if(description != null){
            fields.push(
                {name: 'Description', value: description.value, inline: true}
            );
        };

        if(role_limit != null){
            role_limit = (role_limit.value === 'true').toString();
            fields.push(
                {name: 'Role Limit', value: role_limit, inline: true,}
            );
        }

        fields.push(
            {name: 'Event', value: `[Event Link](${interaction.values[0]})`, inline: true},
        );

        await sendDungeonMenu(interaction, fields, true);
    }
//#endregion

//#region Dungeon
    if(interaction.customId === "dungeon"){
        const dungeon = await Dungeons.findOne({where: {
            name: interaction.values[0]
        }});

        if(dungeon === null){
            console.error("[Database] Dungeon not found.");
            return;
        }

        const dungeonType = await DungeonTypes.findOne({where:{
            name: dungeon.type,
        }})

        if(dungeonType === null){
            console.error("[Database] Dungeon type not found.");
            return;
        }

        const selectionEmbed = interaction.message.embeds[0].fields.find(field => field.name.toLowerCase() === "description")
        const role_limit = interaction.message.embeds[0].fields.find(field => field.name.toLowerCase() === "role limit")
        const partyData = {
            id: short_uuid.generate(),
            type: dungeon.name,
            owner_id: interaction.user.id,
            description: selectionEmbed !== undefined ?  selectionEmbed.value : "\u200b",
            role_limit: role_limit != null ? role_limit.value === 'true' : false,
        }

        const party = await Parties.create(partyData);
        if(party === null){
            console.error("[Database] Failed creating a party.");
            return;
        }

        const eventUrl = interaction.message.embeds[0].fields.find(field => field.name.toLowerCase() === 'event');
        let rx = /^.*\((.*)\)/;
        let result = eventUrl?.value.match(rx);

        const embed = new MessageEmbed()
            .setColor(dungeon.color)
            .setURL((result != null && result[1] != null) ? result[1] : '')
            .setTitle(dungeon.displayname)
            .setDescription(`${dungeonType.displayname}`)
            .setThumbnail(dungeonType.image)
            .setImage(dungeon.image)
            .addFields(
                { name: 'Description', value: `${party.description}`, inline: false},
                { name: 'Players', value: `0 / ${dungeon.player_count}`, inline: true },
                { name: 'Rec. Level', value: `${dungeon.level}+`, inline: true},
                { name: 'Role Limit', value: `${party.role_limit != false ? "Yes":"No"}`, inline: true},
                // { name: '\u200b', value: '―――――――――――――――――――――――――――――'},
            )
            .setTimestamp()
            .setFooter({ text: `Party ID: ${party.id}`});

        const buttons = new MessageActionRow()
            .addComponents([
                // new MessageButton()
                //     .setCustomId('dungeon_join')
                //     .setLabel('Join')
                //     .setStyle('SUCCESS'),
                
                new MessageButton()
                    .setCustomId('dungeon_leave')
                    .setLabel('Leave')
                    .setStyle('DANGER'),

                new MessageButton()
                    .setCustomId('dungeon_delete')
                    .setLabel('Delete')
                    .setStyle('SECONDARY'),

                new MessageButton()
                    .setCustomId('dungeon_kick')
                    .setLabel('Kick')
                    .setStyle('SECONDARY'),
                ]
        );

        // const classEmbed = new MessageEmbed()
        // .setColor('#8888ff')
        // .setTitle("『 Classes 』")
        // .setDescription("Select your class from the dropdown menu below.")
        // // .setTimestamp()
        // // .setFooter({ text: `Party ID: ${party.id}`});

        const classes = await Classes.findAll({
            order: [['name', 'ASC']],
        }).catch(err => console.error(err));

        //interaction.guild.emojis.cache.find(emoji => emoji.name == '');

        let options = [];
        classes.forEach(cls => {
            options.push({
                label: cls.name,
                description: `${cls.type}`,
                value: cls.name,
                emoji: interaction.guild.emojis.cache.find(emoji => emoji.name === cls.name),
            })
        })

        const selectClasses = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('class')
                    .setPlaceholder('Select a class...')
                    .addOptions(options)
        );

        const msg = await interaction.channel.send({embeds: [embed], components: [selectClasses, buttons]}).catch(err => {
            console.error(err);
            return null;
        });
        if(msg == null){
            let embed = getErrorEmbed("Error sending the message with party details.")
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err=>console.error(err));
            await party.destroy();
            return;
        }

        await interaction.channel.threads.create({
            startMessage: msg,
            name: `${dungeon.displayname} || ${party.description}`,
            autoArchiveDuration: 4320
        }).catch(err => {
            console.error(err);
            return;
        });

        const embedSuccess = new MessageEmbed()
        .setColor('#66ff66')
        .setTitle('『 Success 』')
        .setDescription(`Party has been created.`)
        .setTimestamp()
        .setFooter({text: 'Nyaa'});

        await interaction.update({embeds:[embedSuccess], components:[]}).catch(err => console.error(err));
    }
    //#endregion
//#region Class
    if(interaction.customId === "class"){
        const partyEmbed = interaction.message.embeds[0];

        const party = await getPartyFromFooter(interaction.message.embeds[0].footer.text);
        if(party == null){
            console.error("[Database] Party not found.");
            const embed = getErrorEmbed("Party does not exist.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err));
            await interaction.message.delete().catch(err => console.error(err));
            return;
        }

        const playerData = {
            id: interaction.user.id,
            party_id: party.id,
            class: interaction.values[0],
        };

        let embed;

        const dungeonName = interaction.message.embeds[0].title;
        if(dungeonName === undefined){
            embed = getErrorEmbed("Error getting dungeon info.");
            await interaction.reply({embeds:[embed], ephemeral: true, components:[]}).catch(err => console.log(err));
            return;
        }
        const dungeon = await Dungeons.findOne({
            where:{
                displayname: dungeonName,
            }
        }).catch(async err => {
            console.error(err);
            embed = getErrorEmbed("Error getting dungeon info.");
        });

        if(dungeon == null){
            await interaction.reply({embeds:[embed], ephemeral: true, components:[]}).catch(err => console.log(err));
            return;
        }

        //Is there a spot for the player (be it full or no more class specific slots)
        let result = await canPlayerJoin(playerData, party.id, dungeon, interaction).catch(err => {
            console.error(err); 
        });

        if(result === false){
            return;
        }

        //Try to add the player to the party
        const partyMember = await Players.create(playerData).catch(err => {
            console.error(err);
            embed = getErrorEmbed("Couldn't join the party.", `Party ID: ${partyId}`);
        });

        if(partyMember === undefined){
            await interaction.reply({embeds:[embed], ephemeral: true, components:[]}).catch(err => console.log(err));
            return;
        }
        //Add player to the thread
        interaction.channel.threads.fetch(interaction.message.id)
            .then(thread => {
                thread.members.add(partyMember.id, 'Joined the party.').catch(err=>console.error(err));
            })
            .catch(err => {
                console.error(`[Join] No thread found (ID: ${party.id})`);
            });

        embed = getSuccessEmbed('You have joined the party.');

        await updatePartyMessage(party.id, interaction).catch(err => {
            console.error(err);
            embed = getErrorEmbed('Error updating the party info.');
        });

        await interaction.reply({embeds:[embed], components:[], ephemeral: true}).catch(err => {
            console.error(err); 
        });
    }
//#endregion
//#region Kick
    if(interaction.customId === "kick"){
        const party = await getPartyFromFooter(interaction.message.embeds[0].footer.text);
        if(party == null){
            console.error("[Database] Party not found.");
            const embed = getErrorEmbed("Party does not exist.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err));
            await interaction.message.delete().catch(err => console.log(err));
            return;
        }

        const player = await Players.findOne({
            where:{
                party_id: party.id,
                id: interaction.values[0],
            }
        });
        if(player == null){
            let embed = getErrorEmbed("Player not found.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err));
            return;
        }

        //Player is getting kicked
        await player.destroy();

        const message = await interaction.message.fetchReference();
        if(message == null){
            let embed = getErrorEmbed("Party message not found.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err));
            return;
        }
        
        //Delete player from the thread
        interaction.channel.threads.fetch(message.id)
            .then(thread => {
                thread.members.remove(player.id, 'Kicked from party.').catch(err=>console.error(err));
            })
            .catch(err => {
                console.error(`[Kick] No thread found (ID: ${party.id})`);
            });

        await updatePartyMessage(party.id, interaction, message).catch(err => {
            console.error(err);
            embed = getErrorEmbed('Error updating the party info.');
        });

        let embed = getSuccessEmbed(`Kicked: <@${player.id}>`);
        await interaction.update({embeds:[embed], components:[], ephemeral:true}).catch(err => console.error(err));
    }
//#endregion
})
//#endregion

//#region Buttons

client.on('interactionCreate', async interaction => {
    if(!isBotReady(client,interaction)) return;

    if(!interaction.isButton()) return;
//#region Leave
    if(interaction.customId == "dungeon_leave"){
        const party = await getPartyFromFooter(interaction.message.embeds[0].footer.text);
        if(party == null){
            console.error("[Database] Party not found.");
            const embed = getErrorEmbed("Party does not exist.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err));
            await interaction.message.delete().catch(err => console.error(err));
            return;
        }


        const player = await Players.findOne({where: {
            id: interaction.user.id,
            party_id: party.id,
        }})
        if(player === null){
            let embed = getErrorEmbed("You're not in the party.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err));
            return;
        }
        player.destroy();

        //Delete player from the thread
        interaction.channel.threads.fetch(interaction.message.id)
            .then(thread => {
                thread.members.remove(player.id, 'Left the party.').catch(err=>console.error(err));
            })
            .catch(err => {
                console.error(`[Kick] No thread found (ID: ${party.id})`);
            });

        await updatePartyMessage(party.id, interaction);

        let embed = getSuccessEmbed('You have left the party.');
        await interaction.reply({embeds: [embed], ephemeral:true}).catch(err => console.error(err));
    }
//#endregion
//#region Delete

if(interaction.customId == "dungeon_delete"){
    let embed;

    const party = await getPartyFromFooter(interaction.message.embeds[0].footer.text);
    if(party == null){
        console.error("[Database] Party not found.");
        const embed = getErrorEmbed("Couldn't delete (Party does not exist).");
        //Delete the thread
        const thread = interaction.message.thread;
        if(thread !== null) await thread.delete().catch(err => console.error(err));

        await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err));
        await interaction.message.delete().catch(err => console.error(err));
        return;
    }
    
    //Check Permissions (Allow owners delete)
    if(!interaction.member.permissions.has([Permissions.FLAGS.MANAGE_MESSAGES]) && interaction.member.id != party.owner_id){
        embed = getErrorEmbed("Cheeky, aren't you?");
        await interaction.reply({embeds:[embed], ephemeral:true});
        return;
    }

    await party.destroy().then(() => {
        embed = getSuccessEmbed("Successfully deleted the party");
    }).catch(err => {
        console.error(err);
    });

    //Delete the thread
    const thread = interaction.message.thread;
    if(thread !== null) await thread.delete().catch(err => console.error(err));

    await interaction.message.delete().catch(err => console.error(err));
    await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err));
}
//#endregion
//#region Kick
    if(interaction.customId == "dungeon_kick"){
        if(!interaction.member.permissions.has([Permissions.FLAGS.MANAGE_MESSAGES])){
            embed = getErrorEmbed("Cheeky, aren't you?");
            await interaction.reply({embeds:[embed], ephemeral:true});
            return;
        }

        const party = await getPartyFromFooter(interaction.message.embeds[0].footer.text);
        if(party == null){
            console.error("[Database] Party not found.");
            const embed = getErrorEmbed("Party does not exist.");
            await interaction.reply({embeds:[embed], ephemeral:true}).catch(err => console.error(err));
            await interaction.message.delete().catch(err => console.error(err));
            return;
        }

        const players = await Players.findAll({
            where:{
                party_id: party.id
            }
        });
        if(players == null || players.length == 0){
            let embed = getErrorEmbed("No players found.");
            await interaction.reply({embeds: [embed], ephemeral:true}).catch(err=>console.error(err));
            return;
        }

        let options = [];

        for(let player of players){
            let member = await interaction.guild.members.fetch(player.id);
            options.push({
                label: member != null ? `${member.nickname}` : `${player.id}`,
                description: player.class,
                value: `${player.id}`,
                emoji: interaction.guild.emojis.cache.find(emoji => emoji.name === player.class),
            })
        }

        const kickEmbed = new MessageEmbed()
        .setColor('#8888ff')
        .setTitle("『 Kick 』")
        .setDescription("Select the player to kick from the menu below.")
        .setTimestamp()
        .setFooter({ text: `Party ID: ${party.id}`});

        const selectPlayers = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('kick')
                .setPlaceholder('Select a player to kick...')
                .addOptions(options)
            );

        await interaction.reply({embeds:[interaction.message.embeds[0], kickEmbed], components:[selectPlayers], ephemeral: true}).catch(err=>console.error(err));
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

async function updatePartyMessage(partyId, interaction, msg = null){
    const message = msg != null ? msg : interaction.message;
    const partyEmbed = message.embeds[0];
    // const classEmbed = interaction.message.embeds[1];
    //Get playerCount
    const countField = partyEmbed.fields.find(field => field.name.toLowerCase() === 'players');
    if(countField === undefined){
        throw EvalError("Couldn't find players field in the embed.")
    }

    const playerArgs = countField.value.split('/');
    let playerCount = parseInt(playerArgs[0].trim());
    const maxPlayers = parseInt(playerArgs[1].trim());
    playerCount += 1;

    const currentPlayers = await Players.findAll({where:{ party_id: partyId}}).catch(err => console.error(err));

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
        .spliceFields(4, 1, field);

    await message.edit({embeds:[embed]}).catch(err => console.error(err));
}

async function canPlayerJoin(playerData, partyId, dungeon, interaction){
    //Check if party is full
    const partyCount = await Players.count({
        where: {
            party_id: partyId,
        }
    }).catch(err => {
        console.error(err);
    })

    if(partyCount == null){
        return false;
    }

    //If full
    if(partyCount >= dungeon.player_count){
        const embed = getErrorEmbed('Party is full.', `Party ID: ${partyId}`);

        await interaction.reply({embeds:[embed], ephemeral: true}).catch(err => console.error(err));
        return false;
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
        await interaction.reply({embeds:[embed], ephemeral:true});
        return false;
    }

    const party = await Parties.findOne({
        where:{
            id: partyId,
        }
    })

    //Check if party is role limited
    if(party === null){
        let embed = getErrorEmbed(`Error fetching party data.`);
        await interaction.reply({embeds:[embed], ephemeral:true, components:[]}).catch(err => console.log(err));
        return false;
    }
    //if not let em join since other checks have passed.
    if(party.role_limit != true){
        return true;
    }

    const playerClassType = await Classes.findOne({
        where:{
            name: playerData.class,
        }
    })
    if(playerClassType === null){
        let embed = getErrorEmbed(`Error fetching class data.`);
        await interaction.reply({embeds:[embed], ephemeral: true, components:[]}).catch(err => console.log(err));
        return false;
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
            await interaction.reply({embeds:[embed], ephemeral: true, components:[]}).catch(err => console.log(err));
            return false;
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
            await interaction.reply({embeds:[embed], ephemeral: true, components:[]}).catch(err => console.log(err));
            return false;
        }
    }
    return true;
}

async function sendDungeonMenu(interaction, fields, editMessage = false){
    const dungeons = await Dungeons.findAll().catch(err => console.error(err));

    if(dungeons == null){
        console.error("[Dungeons] No dungeons found.");
        return;
    }

    let options = [];
    dungeons.forEach(dungeon => {
        options.push({
            label: dungeon.displayname,
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

    const embed = new MessageEmbed()
    .setColor('#99ffff')
    .setTitle('Party')
    .setDescription('Select a dungeon from the dropdown menu below.')
    .addFields(fields)
    .setTimestamp();

    if(editMessage){
        await interaction.update({embeds: [embed], ephemeral: true, components: [selectDungeons]}).catch(err => console.error(err));
    }
    else{
        await interaction.reply({embeds: [embed], ephemeral: true, components: [selectDungeons]}).catch(err => console.error(err));
    }
}

async function getPartyFromFooter(footer){
    if(footer === undefined || footer === null){
        console.error("[Party] No party ID found while handling buttons.")
    }

    //Get party id. Format: "Party ID: xxx"
    const partyId = footer.split(':')[1].trim();

    if(partyId === undefined){
        console.error("[Party] No party ID present while handling buttons.");
    }

    return await Parties.findOne({
        where:{
            id: partyId,
        }
    }).catch(err => {
        console.error(err);
        return null;
    })
}

async function parseJsonArrays(directory){
    return await fs.readdir(directory).then(async files => {
        files.filter(file => path.extname(file) === '.json');

        let array = [];
        for(let file of files){
            let content = await fs.readFile(directory + file).catch(err => {
                throw Error(err);
            });
            array = array.concat(JSON.parse(content));
        };
        return array;
    }).catch(err => {
        throw Error(err);
    });
}
//#endregion