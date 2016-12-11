/**
 * Created by Chandler Freeman on 11/28/16.
 */
var Promise = require('bluebird');
var Indicators = require('../indicators');

/**
 * Algorithm constants
 */
const RSICutoff = 70;
const minQuotes = 120;

/**
 * Reads indicators and determines buy suitability. Returns true if strong buy signals, returns false if not.
 */
module.exports.determineBuy = function(quote, indicators) {
    var MACD = indicators.MACD;
    var BBAND = indicators.BBAND;
    var RSI = indicators.RSI;

    if (MACD.MACD > 0 && MACD.MACD > MACD.signal && BBAND.high > quote && RSI >= RSICutoff) {
        return true;
    }
    return false;
};

/**
 * Returns a JSON object containing the indicator data
 */
module.exports.calculateIndicatorsAsync = co(function*(quotes) {
    if (quotes.length > minQuotes) {
        var MACD = yield Indicators.MACD(quotes);
        var BBAND = yield Indicators.BBANDS(quotes);
        var RSI = yield Indicators.RSI(quotes);

        var indicatorObject = {};
        indicatorObject['MACD'] = MACD;
        indicatorObject['BBAND'] = BBAND;
        indicatorObject['RSI'] = RSI;

        return indicatorObject;
    }
    return null;
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}