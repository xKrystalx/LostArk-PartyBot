module.exports = function(sequelize, DataTypes){
    return sequelize.define('Players',{
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        party_id:{
            type: DataTypes.UUID,
            references:{
                model: 'Parties',
                key: 'id',
            },
            primaryKey: true,
        },
        class:{
            type: DataTypes.STRING,
            references:{
                model: 'Classes',
                key: 'name',
            }
        },
        level:{
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        }
    })
};