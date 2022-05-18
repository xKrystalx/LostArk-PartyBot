module.exports = function(sequelize, DataTypes){
    return sequelize.define('Dungeons',{
        name: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        displayname:{
            type: DataTypes.STRING,
        },
        player_count: {
            type: DataTypes.INTEGER,
            defaultValue: 4,
        },
        type: {
            type: DataTypes.STRING,
            references:{
                model: 'DungeonTypes',
                key: 'name',
            }
        },
        level:{
            type: DataTypes.INTEGER,
        },
        color:{
            type: DataTypes.STRING,
            defaultValue: '#a0f6ff'
        },
        image: {
            type: DataTypes.STRING,
        },
    })
};