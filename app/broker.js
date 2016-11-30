/**
 * Created by Chandler Freeman on 2/26/16.
 * Adapted from Quiver 1.0 and Quiver-v2.
 *
 * This file is very heavy on the asynchronous code, and uses Promises
 * frequently for ease of use and organization.
 */
var Promise = require('bluebird');
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

// This variable holds an object that contains information about the hours for the current trading day. The
// variable is updated according to WAKEUP_TIME every day, and holds the information for the current day.
var tradingHours;

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
 * Standard initialization procedures, including getting symbol lists, managing data storage, and constructing the Tradier
 * object.
 * 
 * @param {{NODE_DB}} process.env
 */
var init = co(function*() {
    Mongoose.connect(process.env.NODE_DB);
    Logging.log('DATABASE [OK]');
    tradier = new Tradier(Config.account, Config.token);

    Logging.log('Fetching stock list...');
    activeSymbols = yield getWatchlistSymbols();

    Logging.log('Fetching trading hours...');
    var tradingHours = yield getTradingHours();

    Logging.log('Initializing data storage...');
    for (var index in activeSymbols) {
        var symbol = activeSymbols[index];
        yield initializeDataStorageForSymbol(symbol);
        quoteData[activeSymbols[index]] = [];
    }

    var currentTime = Math.getNumericalTime();
    // If the market is closed today
    if (tradingHours.status !== "open") {
        // Just set the interval for 3am and wait
    }
    // Between 3:00am and market open
    else if (WAKEUP_TIME <= currentTime < Math.convertToNumericalTime(tradingHours.open.start)) {
        // Run the 3am routine and set the intervals for SoD
    }
    // Between market open and one hour before market close
    else if (Math.convertToNumericalTime(tradingHours.open.start) <= currentTime < (Math.convertToNumericalTime(tradingHours.open.end) - 3600000)) {
        // Trade!!
    }
    // Between 0:00 and 3:00am, After market close 
    else {
        // Just set the 3am interval and wait
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

// Updates the broker using the market state. Start trading when open, stop when closed, etc.
var updateMarketClock = Promise.coroutine(function*() {
    var intradayStatus = yield new Tradier().getMarketClock();
    if (typeof intradayStatus == 'undefined') {
        return;
    }

    Logging.logMarketEvent('Market status: ' + intradayStatus.clock.state);
    if (nextMarketState === 'open' && tradeInterval === null) {
        yield loadquoteData();
        Logging.log('Collecting initial data...');
        tradeInterval = setInterval(trade, TICK_INTERVAL);
        trade();
    } else if (nextMarketState === 'postmarket') {
        if (tradeInterval !== null) {
            clearInterval(tradeInterval);
        }
        tradeInterval = null;
        capitalAvailable = capital;
        tradeData = {};
        stocksOwned = 0;
    }

    // This must be run last
    setMarketClockInterval(intradayStatus);
});

/**
 * See comment for marketClockInterval variable.
 * @param {Object[]} intradayStatus
 * @param {Object[]} intradayStatus.clock
 * @param {string} intradayStatus.clock.next_change
 * @param {string} intradayStatus.clock.next_state
 */
function setMarketClockInterval(intradayStatus) {
    if (marketClockInterval !== null) {
        clearInterval(marketClockInterval);
        marketClockInterval = null;
    }

    /*
     Use the next_change time property to determine if the API is out of date, and if it is, then
     wait a few minutes and try again.
     */

    /* The Tradier API is delayed by a few minutes when updating intraday market status. In order
     * to circumvent this issue, the state of the market is stored according to the API request,
     * and if the status stays the same, the interval is set to run 3 minutes later, until the
     * status can be updated.
     */
    if (nextMarketState === null || intradayStatus.clock.state === nextMarketState) {
        var times = intradayStatus.clock.next_change.split(':');
        var hours = parseInt(times[0]);
        var minutes = parseInt(times[1]);

        var nextStateChange = new Date().setHours(hours, minutes, 0, 0);
        var clock = intradayStatus.clock;
        Logging.logMarketEvent('Next market state change @ ' + clock.next_change + ': ' + clock.next_state);

        var timeUntilNextStateChange = nextStateChange - (new Date());
        marketClockInterval = setInterval(updateMarketClock, timeUntilNextStateChange);
        nextMarketState = intradayStatus.clock.next_state;
    } else {
        // 180000 milliseconds = 3 minutes
        marketClockInterval = setInterval(updateMarketClock, 180000);
    }
}

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