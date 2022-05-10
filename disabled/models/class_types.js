const {Sequelize, DataTypes} = require('sequelize');

module.exports = function(sequelize){
    return sequelize.define('ClassTypes',{
        name: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
    })
};