/**
 * Created by Chandler Freeman on 2/26/16.
 * Adapted from Quiver 1.0 and Quiver-v2.
 *
 * This file is very heavy on the asynchronous code, and uses Promises
 * frequently for ease of use and organization.
 */
var Promise = require('bluebird');
var Schedule = require('node-schedule');
var Logging = require('./logging');
var Math = require('./math');
var Playground = require('./playground');

// API
var Tradier = require('./APIs/tradier');

// Algorithms
var BuyAlgorithm = require('./algorithms/buy');
var SellAlgorithm = require('./algorithms/sell');
var AllocationAlgorithm = require('./algorithms/allocate');

// Mongoose models
var Stock = require('./models/stock');

// Database objects
var Mongoose = require("mongoose");
var Config = require('../config/tradier');

// The time interval at which trade() is run. One minute = 60000
const TICK_INTERVAL = 30000;

// The interval for trade() is run based on TICK_INTERVAL
var tradeInterval = null;

// TRADing rEadyness CONdition. See Trello for documentation.
var TRADECON = 5;

/** 
 * The time at which the program updates the trading hours variable for the day. It is stored
 * as a number representing the milliseconds since midnight.
 * 
 * This is also a constant that is represented in other ways throughout the program. So don't
 * change it.
 */
var WAKEUP_TIME = 10800000; // She says it's cold outside and she hands me my raincoat...

// Contains the interval for the midnightRun() function. It is run at WAKEUP_TIME every day.
var midnightRunInterval;

// This variable holds an object that contains information about the hours for the current trading day. The
// variable is updated according to WAKEUP_TIME every day, and holds the information for the current day.
var tradingHours;

// Timeout for openingBell() functions
var openingBellTimeout;

// The required number of quotes before trading begins.
const REQUIRED_QUOTES = 80;

// Algorithm constants
const RSICutoff = 70;

/*
 * @var quoteData will contain a JSON object that looks like this:
 * {
 *    'symbol': [quote1, quote2, quote3, ...],
 *    'symbol2': [quote1, quote2, ...],
 *    ...
 * }
 */
var quoteData = {};

/*
 * @var tradeData will contain a JSON object that looks like this:
 * {
 *    'symbol': {
 *      purchasePrice: 0.00,
 *      shares: 0,
 *      divorceLower: 0.00
 *    },
 *    ...
 * }
 *
 * Stocks will only exist in this Object if they have been purchased.
 */
var tradeData = {};
var stocksOwned = 0;

/**
 * The array of symbols currently being traded.
 */
var activeSymbols = [];

// The available cash for the day each day, and the cash remaining for the current day. capital
// doesn't change, but capitalAvailable = capital at the end of each day.
var capital;
var capitalAvailable;

// The instance of Tradier that will be used to make trades.
var tradier;

/**
 * Function that the Broker child process enters into; basically runs tests or init() depending 
 * on the environment.
 */
process.on('message', function(argv) {
    Logging.log(argv);
    switch(process.env.NODE_ENV) {
        case 'playground':
            co(function*(){
                yield Playground.playground();
            })();
            break;
        default:
            init();
    }
});

/**
 * Standard initialization procedures, like building the database connection and constructing the Tradier
 * object. It also gets the current time and sets broker state accordingly.
 * 
 * @param {{NODE_DB}} process.env
 */
var init = co(function*() {
    Mongoose.connect(process.env.NODE_DB);
    Logging.log('DATABASE [OK]');
    tradier = new Tradier(Config.account, Config.token);
    tradingHours = yield getTradingHours();

    // Make sure the market is open today
    if (tradingHours.status === "open") {
        var currentTime = Math.getNumericalTime();
        var marketOpenTime = Math.convertToNumericalTime(tradingHours.open.start);
        var marketCloseTime = Math.convertToNumericalTime(tradingHours.open.end);

        // If the time is between 3am and market open
        if (WAKEUP_TIME <= currentTime && currentTime < marketOpenTime) {
            midnightRun();
        }
        // If the time is between market open and one hour before market close
        else if (marketOpenTime <= currentTime && currentTime <= (marketCloseTime - 3600000)) {
            openingBell();
        }
    }

    // Set the midnight run interval
    midnightRunInterval = Schedule.scheduleJob('0 3 * * *', midnightRun);
});

/**
 * Run on schedule early every day before trading beings. It pulls down the market hours for the
 * day and sets the interval for the start of day(coffee) function.
 */
var midnightRun = co(function*(symbol) {
    Logging.log('On another midnight run...');
    tradingHours = yield getTradingHours();

    if (tradingHours.status === "open") {
        var msTillOpen = Math.convertToNumericalTime(tradingHours.open.start) - Math.getNumericalTime();

        // Run openingBell at tradingHours.open.start, or market open
        openingBellTimeout = setTimeout(openingBell, msTillOpen);
    }
});

/**
 * This is the function for SoD(start of day). It runs at market open. It performs standard initialization 
 * procedures, including getting symbol lists, managing data storage, and setting function intervals.
 */
var openingBell = co(function*() {
    Logging.log('=== Begin trading for ' + Math.getDate() + ' ===');
    activeSymbols = yield getWatchlistSymbols();

    for (var index in activeSymbols) {
        var symbol = activeSymbols[index];
        yield initializeDataStorageForSymbol(symbol);
    }

    tradeInterval = setInterval(trade, TICK_INTERVAL);
    trade();
});

/**
 * This is the function for EoD(end of day). It runs at market close. It acts as a cleanup function by
 * clearing variables and intervals.
 */
var closingBell = co(function*() {
    Logging.log('=== End trading for ' + Math.getDate() + ' ===');
});

/**
 * Returns an object containing the trading hours for the current day.
 */
var getTradingHours = co(function*() {
    var calendar = yield tradier.getMarketCalendar();
    var dateToday = Math.getDate();
    for (var index in calendar.calendar.days.day) {
        var day = calendar.calendar.days.day[index];
        if (day.date === dateToday) {
            return calendar.calendar.days.day[index];
        }
    }
});

/**
 * Returns an array of stocks to watch from the Tradier default watchlist.
 */
var getWatchlistSymbols = co(function*() {
    var watchlist = yield tradier.getDefaultWatchlist();
    var updatedActiveSymbols = [];
    for (index in watchlist.watchlist.items.item) {
        updatedActiveSymbols[index] = watchlist.watchlist.items.item[index].symbol;
    }
    return updatedActiveSymbols;
});

/**
 * Creates a subdocument in the database for the trading day for a certain symbol.
 */
var initializeDataStorageForSymbol = co(function*(symbol) {
    // Search for object with the symbol in the database, and create a new one if it doesn't find one
    var stockObject = yield Stock.findOne({ 'symbol': symbol });
    if (!stockObject) {
        stockObject = new Stock({ 'symbol': symbol });
    }

    // Calculate the Divorce algorithm lower buffer value so we can store it for today
    var quote = yield tradier.getQuotes([symbol]);
    var buffer = yield SellAlgorithm.determineDivorceLower(quote.quotes.quote.low, quote.quotes.quote.high);

    // Create a subdocument for today's trading
    stockObject.data.push({
        quotes: [],
        MACD: [],
        BBAND: [],
        RSI: [],
        divorceBuffer: buffer
    });
    yield stockObject.save();

    // Ensure the symbol is in our local object as well
    quoteData[symbol] = [];
});

/**
 * Where the magic happens.
 */
var trade = co(function*() {
    var updatedSymbols = yield getWatchlistSymbols();

    // Bbb... Bbbbbb... Butttt Chandler, this isn't the right way to compare strings in JS! We don't need to
    // compare them strictly, because any change in the array should trigger the refresh, so it works.
    if (JSON.stringify(activeSymbols) !== JSON.stringify(updatedSymbols)) {
        for (index in updatedSymbols) {
            // If the symbol isn't in the current list
            if (activeSymbols.indexOf(updatedSymbols[index]) === -1) {
                initializeDataStorageForSymbol(updatedSymbols[index]);
                Logging.log("Now actively trading " + updatedSymbols[index]);
            }
        }
        activeSymbols = updatedSymbols;
    }

    var quotes = yield tradier.getQuotes(activeSymbols);
    for (var index in activeSymbols) {
        var symbol = activeSymbols[index];
        var quote = quotes.quotes.quote[index].last.toFixed(2);
        var stockObject = yield Stock.findOne({ 'symbol': symbol });

        // Store the new quote price in the local variable and the database
        quoteData[symbol].push(quote);
        stockObject.data[stockObject.data.length - 1].quotes.push(quote);

        var indicators = BuyAlgorithm.calculateIndicators(quoteData[symbol]);
        var divorceLowerValue = null;

        // If we don't have enough data to calculate indicators yet, we can just store the null
        // values and skip this symbol
        if (indicators === null) {
            stockObject.data[stockObject.data.length - 1].MACD.push(null);
            stockObject.data[stockObject.data.length - 1].BBAND.push(null);
            stockObject.data[stockObject.data.length - 1].RSI.push(null);
            stockObject.data[stockObject.data.length - 1].divorceLowerBound.push(null);

            yield stockObject.save();
            continue;
        }
            
        // If we don't already own the stock, look for buy indicators
        if (!tradeData.hasOwnProperty(stock) && stocksOwned < MAX_OWNED) {
            if (BuyAlgorithm.determineBuy(indicators) === true) {
                var shares = AllocationAlgorithm.getShares(capitalAvailable, quote);
                if (shares > 0) {
                    tradier.placeLimitOrder(symbol, "buy", shares, quote);

                    var divorceLowerStart = quote - stockObject.data.divorceBuffer;
                    tradeData[symbol] = {
                        purchasePrice: quote,
                        shares: shares,
                        lowerBound: divorceLowerStart,
                        divorceBuffer: stockObject.data.divorceBuffer
                    };
                }
            }
        }
        // If we already own the stock, let the sell algorithm work
        else if (tradeData.hasOwnProperty(symbol)) {
            var sellSignal = SellAlgorithm.determineSell(quote, tradeData[symbol]);
            if (sellSignal === true) {
                tradier.placeMarketOrder(symbol, "sell", shares);
                delete tradeData[symbol];
            }
            else {
                var lower = sellSignal;
                tradeData[symbol].lowerBound = lower;
                divorceLowerValue = lower;
            }
        }

        stockObject.data[stockObject.data.length - 1].MACD.push(indicators.MACD);
        stockObject.data[stockObject.data.length - 1].BBAND.push(indicators.BBAND);
        stockObject.data[stockObject.data.length - 1].RSI.push(indicators.RSI);
        stockObject.data[stockObject.data.length - 1].divorceLowerBound.push(divorceLowerValue);

        yield stockObject.save();
    }

    // At the end of trade()
    // at < ten minutes to market close
        // firesale
        // return
    // at < 30 minutes to market close
        // if we own shares or have pending buy orders
            // set tradecon to 4
        // else
            // clear trade interval / cleanup
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}