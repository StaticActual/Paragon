/**
 * Created by Chandler Freeman on 11/28/16.
 */
var Promise = require('bluebird');
var Indicators = require('../indicators');

/**
 * Divorce algorithm constants
 */
const ADRMultiplier = 0.0485;
const Offset = 0.01;

/**
 * Reads indicators and determines buy suitability. Returns true if stock is ready to sell, returns the
 * new lower bound value otherwise.
 */
module.exports.determineSell = function(quote, stockData) {
    // If the quote is equal to or less than the lower bound, return a sell signal
    if (quote <= stockData.lowerBound) {
        return true;
    }
    // Otherwise, if the quote is greater than the lower bound, raise it accordingly
    else if (quote > stockData.lowerBound) {
        var newLower = quote - stockData.divorceBuffer;
        if (newLower > stockData.lowerBound) {
            return newLower;
        }
        return stockData.lowerBound;
    }
};

/**
 * Calculates the start value for the Divorce algorithm. 
 * 
 * @param {string} low - The last daily low.
 * @param {string} high - The last daily high.
 * 
 * The function returns a 2-decimal float number. For example, the function would 
 * return 0.02 if the start point for the Divorce algorithm is supposed to be 2 cents 
 * lower than the share price.
 */
module.exports.determineDivorceLowerAsync = co(function*(low, high) {
    var ADR = yield Indicators.ADR(low, high);
    var lower = ADRMultiplier * ADR + Offset;
    return lower.toFixed(2);
}); 

// This function can be used to tune the Divorce algorithm constants
    // Logging.log('Testing calculateLower()');
    // var stocks = stockList.stocks;
    // for (var stock in stocks) {
    //     var quote = yield RobinhoodInterface.getQuote(stocks[stock]);
    //     var lower = yield calculateLower(stocks[stock]);
    //     var value = (quote - (yield calculateLower(stocks[stock]))).toFixed(2);
    //     Logging.log(stocks[stock] + ' @ ' + quote + ':' + lower + ' = ' + value);
    // }

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}