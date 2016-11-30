/**
 * Created by Chandler Freeman on 11/28/16.
 */
var Promise = require('bluebird');
var Logging = require('./logging');
var Config = require('../config/tradier');
var Indicators = require('./indicators');
var Math = require('./math');
var Tradier = require('./APIs/tradier');

/**
 * This method tests acts as a testing ground for new code. It can be used to tune algorithms or while developing
 * new functions.
 */
module.exports.playground = co(function*() {
    Logging.log('Playground');
    var tradier = new Tradier(Config.account, Config.token);

    Logging.log(Math.convertToNumericalTime("03:00"));
    Logging.log(Math.convertToNumericalTime("09:30"));
    Logging.log(Math.convertToNumericalTime("16:00"));
    Logging.log(Math.convertToNumericalTime("24:00"));

    Logging.log('Playground complete');
    process.exit(0);
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}