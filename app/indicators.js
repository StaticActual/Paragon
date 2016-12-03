/**
 * Created by Chandler Freeman on 3/3/16.
 */
var Promise = require('bluebird');
var Talib = require('talib');
var MathHelper = require('./katherine');

module.exports = {};

/**
 * Calculates the MACD values given an array of quote data.
 *
 * @param {quotes}			Array				Array containing quote values.
 *
 * Returns an object:
 * {
 *    "MACD": MACD,
 *    "signal": MACDSignal
 * }
 */
module.exports.MACD = function(quotes) {
  var promise = new Promise(function(resolve, reject) {
    Talib.execute({
      name: "MACD",
      startIdx: 0,
      endIdx: quotes.length - 1,
      inReal: quotes,
      optInFastPeriod: 12,
      optInSlowPeriod: 26,
      optInSignalPeriod: 9
    }, function(MACDData) {
      var MACD = MACDData.result.outMACD[MACDData.result.outMACD.length - 1];
      var MACDSignal = MACDData.result.outMACDSignal[MACDData.result.outMACDSignal.length - 1];
      resolve({
        "MACD": +(MACD.toFixed(4)),
        "signal": +(MACDSignal.toFixed(4))
      });
    });
  });
  return promise;
};

/**
 * Calculates the MACD values given an array of quote data.
 *
 * @param {quotes}			Array				Array containing quote values.
 *
 * Returns an object:
 * {
 *    "high": upper,
 *    "mid": mid,
 *    "low": lower
 * }
 */
module.exports.BBANDS = function(quotes) {
  var promise = new Promise(function(resolve, reject) {
    Talib.execute({
      name: "BBANDS",
      startIdx: 0,
      endIdx: quotes.length - 1,
      inReal: quotes,
      optInTimePeriod: 12,
      optInNbDevUp: 2,
      optInNbDevDn: 2,
      optInMAType: 0
    }, function(BBANDS) {
      var upper = BBANDS.result.outRealUpperBand[BBANDS.result.outRealUpperBand.length - 1];
      var mid = BBANDS.result.outRealMiddleBand[BBANDS.result.outRealMiddleBand.length - 1];
      var lower = BBANDS.result.outRealLowerBand[BBANDS.result.outRealLowerBand.length - 1];
      resolve({
        "high": +(upper.toFixed(4)),
        "mid": +(mid.toFixed(4)),
        "low": +(lower.toFixed(4))
      });
    });
  });
  return promise;
};

/**
 * Calculates the RSI given an array of quote data.
 *
 * @param {quotes}			Array				Array containing quote values.
 */
module.exports.RSI = function(quotes) {
  var promise = new Promise(function(resolve, reject) {
    Talib.execute({
      name: "RSI",
      startIdx: 0,
      endIdx: quotes.length - 1,
      inReal: quotes,
      optInTimePeriod: 7
    }, function(RSIData) {
      var RSI = RSIData.result.outReal[RSIData.result.outReal.length - 1];
      resolve(+(RSI.toFixed(4)));
    });
  });
  return promise;
};

/**
 * Calculates Average Daily Range.
 *
 * @param {min}			Float				Daily low.
 * @param {max}			Float				Daily high.
 */
module.exports.ADR = function(min, max) {
  var promise = new Promise(function(resolve, reject) {
    var minCents = MathHelper.convertToIntegerCents(min);
    var maxCents = MathHelper.convertToIntegerCents(max);
    var ADR = Math.ceil((maxCents - minCents) / 2);
    resolve(MathHelper.convertToFloatDollars(ADR));
  });
  return promise;
};