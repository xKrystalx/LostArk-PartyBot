module.exports = function(sequelize, DataTypes){
    return sequelize.define('Classes',{
        name: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        type:{
            type: DataTypes.STRING,
        }
    });
};