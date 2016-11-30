/**
 * Created by Chandler Freeman on 2/26/16.
 * Adapted from Quiver 1.0 and Quiver-v2.
 *
 * This file is very heavy on the asynchronous code, and uses Promises
 * frequently for ease of use and organization.
 */
var Promise = require('bluebird');
var Schedule = require('node-schedule');
var Indicators = require('./indicators');
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
const TICK_INTERVAL = 60000;

// The interval for trade() is run based on TICK_INTERVAL
var tradeInterval = null;

/** 
 * The time at which the program updates the trading hours variable for the day. It is stored
 * as a number representing the milliseconds since midnight.
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
    midnightRunInterval = schedule.scheduleJob('0 3 * * *', midnightRun);
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
    Logging.log('Fetching stock list...');
    activeSymbols = yield getWatchlistSymbols();

    Logging.log('Initializing data storage...');
    for (var index in activeSymbols) {
        var symbol = activeSymbols[index];
        yield initializeDataStorageForSymbol(symbol);
        quoteData[activeSymbols[index]] = [];
    }

    tradeInterval = setInterval(trade, TICK_INTERVAL);
    trade();
});

/**
 * This is the function for EoD(end of day). It runs at market close. It acts as a cleanup function by
 * clearing variables and intervals.
 */
var closingBell = co(function*() {
    
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
});

/**
 * The main function for the broker.
 */
var trade = Promise.coroutine(function*() {
    for (var stock in quoteData) {

        // Retrieve database stock object
        var stockObject = yield Stock.findOne({ 'symbol': stock });

        // Retrieve quote
        var quote = yield RobinhoodInterface.getQuote(stock);
        if (!quote) {
            quoteData[stock].push(null);
            stockObject.data[stockObject.data.length - 1].quotes.push(null);
            stockObject.data[stockObject.data.length - 1].MACD.push(null);
            stockObject.data[stockObject.data.length - 1].BBAND.push(null);
            stockObject.data[stockObject.data.length - 1].RSI.push(null);

            /* Save the stock object to the db */
            yield stockObject.save();
            continue;
        }

        // Store quote in database object for this session
        quoteData[stock].push(quote);
        stockObject.data[stockObject.data.length - 1].quotes.push(quote);

        // Stock data point
        var MACD, BBAND, RSI;

        // If the number of required data points has been met
        if (quoteData[stock].length > REQUIRED_QUOTES) {

            /* Calculate our indicators for the algorithm */
            MACD = yield Indicators.MACD(quoteData[stock]);
            BBAND = yield Indicators.BBANDS(quoteData[stock]);
            RSI = yield Indicators.RSI(quoteData[stock]);

            /* Store the indicators in the database object */
            stockObject.data[stockObject.data.length - 1].MACD.push(MACD);
            stockObject.data[stockObject.data.length - 1].BBAND.push(BBAND);
            stockObject.data[stockObject.data.length - 1].RSI.push(RSI);

            // If we don't own the stock, look to buy
            if (!tradeData.hasOwnProperty(stock) && stocksOwned < MAX_OWNED) {

                /* If the indicator test passes, we buy */
                if (MACD.MACD > 0 && MACD.MACD > MACD.signal && BBAND.high > quote && RSI >= RSICutoff) {

                    // Calculate the total number of shares that can be purchased
                    var shares = AllocationAlgorithm.getShares(capitalAvailable, quote);
                    if (shares > 0) {

                        /* Place the buy order */
                        var buyOrder = yield RobinhoodInterface.marketOrder(robinhoodUser, 'buy', stock, quote, shares);
                        if (!buyOrder) {
                            continue;
                        }

                        Logging.logBuyOrder(stock, shares, price);
                        capitalAvailable -= Math.ceil(quote * shares);
                        var buyTimeNumber = quoteData[stock].length - 1;
                        var lower = (quote - stockObject.data.lower).toFixed(2);
                        tradeData[stock] = {
                            buyTime: buyTimeNumber,
                            buyPrice: quote,
                            shares: shares,
                            lowerBound: lower
                        };

                        /* Store the sell points in the database */
                        stockObject.data[stockObject.data.length - 1].tradeHistory.push(tradeData[stock]);
                        stocksOwned++;
                    }
                }
            }

            // If we do own the stock, manage the lower bound and look to sell
            else if (tradeData.hasOwnProperty(stock)) {

                // Get the trade history for the stock
                var tradeHistory = stockObject.data[stockObject.data.length - 1].tradeHistory;

                // If the quote is equal to or less than the lower bound, sell
                if (quote <= tradeData[stock].lowerBound) {

                    /* Place sell order */
                    var sellOrder = yield RobinhoodInterface.marketOrder(robinhoodUser, 'sell', stock, quote, tradeData[stock].shares);
                    if (!sellOrder) {
                        continue;
                    }

                    Logging.logSellOrder(stock, tradeData[stock].shares, tradeData[stock].buyPrice, quote);
                    tradeHistory[tradeHistory.length - 1].sellTime = quoteData[stock].length - 1;
                    tradeHistory[tradeHistory.length - 1].sellPrice = quote;

                    delete tradeData[stock];
                    stocksOwned--;
                }

                // Otherwise, if the quote is greater than the lower bound, raise it accordingly
                else if (quote > tradeData[stock].lowerBound) {
                    var newLower = (quote - stockObject.data.lower).toFixed(2);
                    if (newLower > tradeData[stock].lowerBound) {
                        tradeData[stock].lowerBound = newLower;
                        tradeHistory[tradeHistory.length - 1].lowerBound = newLower;
                    }
                }

                // Save the trade data for the stock
                stockObject.data[stockObject.data.length - 1].tradeHistory = tradeHistory;
            }
        }

        // If the indicators weren't set, make them null data points
        if (!MACD) {
            stockObject.data[stockObject.data.length - 1].MACD.push(null);
        }
        if (!BBAND) {
            stockObject.data[stockObject.data.length - 1].BBAND.push(null);
        }
        if (!RSI) {
            stockObject.data[stockObject.data.length - 1].RSI.push(null);
        }

        /* Save the stock object to the db */
        yield stockObject.save();
    }
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}