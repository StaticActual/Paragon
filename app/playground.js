/**
 * Created by Chandler Freeman on 11/28/16.
 */
var Promise = require('bluebird');
var Logging = require('./logging');
var Config = require('../config/tradier');
var Indicators = require('./indicators');
var MathHelper = require('./katherine');
var Tradier = require('./APIs/tradier');

// Algorithms
var BuyAlgorithm = require('./algorithms/buy');
var SellAlgorithm = require('./algorithms/sell');
var AllocationAlgorithm = require('./algorithms/allocate');

// Example quote data
var quotes = {
  'AUY': [1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.40, 2.30, 3.10, 4.30, 5.40, 6.30, 7.40, 8.30, 9.40,
    9.50, 9.40, 10.30, 10.40, 11.30, 11.40, 12.30, 13.47, 14.56, 15.20, 16.78],
  'NM': [12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40,
    12.30, 13.40, 12.30, 13.40, 12.30, 11.40, 10.65, 9.10, 7.87, 9.40, 11.30, 12.10, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40,
    12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.47, 14.56, 15.20, 16.78],
  'ONE': [ 12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30,
    12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 
    13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30,
    15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 14.20, 14.30, 13.90,
    12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40 ]
};

/**
 * This method tests acts as a testing ground for new code. It can be used to tune algorithms or while developing
 * new functions.
 */
module.exports.playground = co(function*() {
    Logging.log('Playground');
    var tradier = new Tradier(Config.account, Config.token);

    console.time("indicators");
    var indicators = yield BuyAlgorithm.calculateIndicators(quotes["ONE"]);
    console.timeEnd("indicators");
    Logging.logObject(indicators);

    Logging.log('Playground complete');
    process.exit(0);
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}