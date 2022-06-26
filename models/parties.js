module.exports = function(sequelize, DataTypes){
    return sequelize.define('Parties',{
        id: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        type: {
            type: DataTypes.STRING,
            references:{
                model: 'Dungeons',
                key: 'name',
            }
        },
        description:{
            type: DataTypes.STRING,
            defaultValue: "",
        },
        owner_id:{
            type: DataTypes.STRING,
        },
        role_limit:{
            type: DataTypes.BOOLEAN,
            defaultValue: 0,
        }
    })
};