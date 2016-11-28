/**
 * Copyright (c) 2016 Chandler Freeman
 * Created on 10/23/16.
 */
var Config = require('../config/tradier.js');
var Math = require('./math');

/**
 * Logs the settings used when the program starts.
 */
module.exports.logApplicationStartup = function logApplicationStartup() {
    console.log('******** Paragon is running ********');
    console.log('   time: ' + Math.getTimestamp());
    console.log('   env: ' + process.env.NODE_ENV);
    console.log('   account: ' + Config.account);
    console.log('   database: ' + process.env.NODE_DB);
    console.log('******** Begin Paragon activity log ********');
};

module.exports.log = function log(message) {
    console.log('[' + Math.getTimestamp() + '] ' + message);
};

module.exports.logObject = function log(object) {
    console.log('[' + Math.getTimestamp() + '] [object]');
    for (var property in object) {
        console.log('   - ' + property);
    }
};

module.exports.logBuyOrder = function log(symbol, shares, price) {
    console.log('[' + Math.getTimestamp() + '] [buy]: ' + shares + ' shares of ' + symbol + ' at ' + price);
};

module.exports.logSellOrder = function log(stock, shares, buyPrice, sellPrice) {
    var gainLossSymbol;
    if (buyPrice > sellPrice) {
        gainLossSymbol = '-';
    }
    else if (buyPrice < sellPrice) {
        gainLossSymbol = '+';
    }
    else {
        gainLossSymbol = '=';
    }

    var timestamp = '[' + Math.getTimestamp() + '] ';
    console.log(timestamp + gainLossSymbol + '[sell]: ' + shares + ' shares of ' + symbol);
    console.log('   buy price: ' + buyPrice);
    console.log('   sell price: ' + sellPrice);
};

module.exports.logMarketEvent = function log(message) {
    console.log('[' + Math.getTimestamp() + '] [market]: ' + message);
};

module.exports.logError = function logError(message) {
    // TODO: Write to separate error logging file
    console.log('[' + Math.getTimestamp() + '] [ERROR] ' + message);
};
