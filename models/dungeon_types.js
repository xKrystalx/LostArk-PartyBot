module.exports = function(sequelize, DataTypes){
    return sequelize.define('DungeonTypes',{
        name: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        displayname: {
            type: DataTypes.STRING,
        },
        image: {
            type: DataTypes.STRING,
        },
    })
};