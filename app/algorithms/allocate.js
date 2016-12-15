/**
 * Created by Chandler Freeman on 11/28/16.
 */
var MathHelper = require('../katherine');

/**
 * Algorithm constants
 */
const percentOfNetValuePerTrade = 0.05;

/**
 * Returns the number of shares the user can purchase, given the current price.
 */
module.exports.getShares = function(netCapital, tradingCapital, quote) {
    var funds = percentOfNetValuePerTrade * netCapital;
    if (funds >= tradingCapital) {
        return 0;
    }
    return Math.floor(funds / quote);
};

/**
 * Returns the balance we can trade with in one day.
 */
module.exports.calculateTradingCapital = function(accountValue) {
    return Math.floor(accountValue);
};