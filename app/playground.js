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

    var activeSymbols = ["AUY", "MU", "NM"];

    Logging.log("       - Invalid buffer value for [" + "MU" + "]; Removing");
    var index = activeSymbols.indexOf("MU");
    if (index > -1) {
        activeSymbols.splice(index, 1);
    }

    Logging.log(activeSymbols);

    // var runThisCo = co(function*() {
    //     console.log("coFunc");
    //     for (var i = 0; i<10; ++i) {
    //         console.log("coFunc " + i);
    //     }
    //     // yield runThisCo2();
    // });

    // var runThisCo2 = co(function*() {
    //     console.log("coFunc2");
    //     for (var i = 0; i<10; ++i) {
    //         console.log("coFunc2 " + i);
    //     }
    // });

    // var runThisSync = function*() {
    //     console.log("Hello world in 5");
    // }

    // function* runThisDuo() {
    //     console.log("Duo testing!");
    // }

    // function named() {
    //     console.log("Calling");
    //     runThisSync();
    //     runThisDuo();
    //     //runThisCo(); // running this function asyncronously
    //     co(runThisSync); // running this function asyncronously
    //     console.log("Later h8ter");
    // }

    // function* onlyOneYield() {
    //     yield co(function*() {
    //         console.log("coFunc");
    //         setTimeout(function() {
    //             console.log("A short time later");
    //         }, 5000);
    //     });
    // }

    // function norm() {
    //     console.log("Before");
    //     co(function*() {
    //             yield runThisCo();
    //         })();
    //     co(function*() {
    //             yield runThisCo2();
    //         })();
    //     console.log("After");
    // }

    // norm();

    // var MyAPIWrapper = function() {
    //     this.options = {
    //         someValue: "42"
    //     };
    // };

    // MyAPIWrapper.prototype.mutateThis = function() {
    //     var localOptions = this.options;
    //     localOptions.someValue = "7";
    //     console.log(localOptions.someValue);
    //     console.log(this.options.someValue);
    // }

    // var APIWrapper = new MyAPIWrapper();
    // APIWrapper.mutateThis();

    // var arrayOne = {
    //     prop: 4
    // };

    // var arrayTwo = arrayOne;
    // arrayTwo.prop = 5;

    // console.log(arrayOne.prop);
    // console.log(arrayTwo.prop);

    // var capital = 100000;
    // var days = 20;
    // var dailyReturn = 0.003;
    // for (var i = 0; i < days; i++) {
    //     capital += (capital * dailyReturn);
    // }
    // Logging.log(capital.toFixed(2));

    Logging.log('Playground complete');
    process.exit(0);
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}