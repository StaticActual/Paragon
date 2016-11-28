/**
 * Copyright (c) 2016 Chandler Freeman
 * Created on 4/13/16.
 *
 * This file contains math helper functions that can be used by the broker. They can be used for
 * conversions, statistics, date-time, etc.
 */
var Logging = require('./logging');

/**
 * Since the broker operates entirely using integer cent values, it needs a way to convert values
 * it receives into cents(integers), regardless of how those values may come in. For example,
 * Robinhood supplies 4 decimal place values for some stocks. However, we only work with 2, so
 * this needs to be handled appropriately. This method is used when data is passed in the Broker.
 */
module.exports.convertToIntegerCents = function(value) {
    // First, convert it to a float
    var float = parseFloat(value);

    // Round the number to 2 decimal places if it has more.
    var rounded = +(float.toFixed(2));

    // Change the rounded value into cents and return it.
    return +((rounded * 100).toFixed(0));
};

/**
 * This method takes a cents value and outputs a currency-formatted string. This method is used
 * when a value is sent from the broker to Robinhood.
 */
module.exports.convertToStringDollars = function(cents) {
    if (typeof cents != "number") {
        Logging.log('Must pass integer to convertToStringDollars()');
        return;
    }
    return parseFloat(cents / 100).toFixed(2);
};

/**
 * This method takes a cents value and outputs a float.
 */
module.exports.convertToFloatDollars = function(cents) {
    if (typeof cents != "number") {
        Logging.log('Must pass integer to convertToFloatDollars()');
        return;
    }
    return +(parseFloat(cents / 100).toFixed(2));
};

/**
 * Returns the current date and time as a string in mm-dd-yyyy hh:mm:ss format, used for logging
 */
module.exports.getTimestamp = function() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1; //January is 0!
    var hr = today.getHours();
    var m = today.getMinutes();
    var ss = today.getSeconds();
    var yyyy = today.getFullYear();

    if (dd < 10) {
        dd = '0' + dd
    }

    if (mm < 10) {
        mm = '0' + mm
    }

    if (m < 10) {
        m = '0' + m
    }

    if (ss < 10) {
        ss = '0' + ss
    }

    return mm + '-' + dd + '-' + yyyy + ' ' + hr + ':' + m + ':' + ss;
};

/**
 * Returns the current date as a string in yyyy-mm-dd format 
 */ 
module.exports.getDate = function() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1; //January is 0!
    var yyyy = today.getFullYear();

    if (dd < 10) {
        dd = '0' + dd
    }

    if (mm < 10) {
        mm = '0' + mm
    }

    return yyyy + '-' + mm + '-' + dd;
};
