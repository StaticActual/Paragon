/**
 * Created by Chandler Freeman on 2/26/16.
 * Adapted from Quiver 1.0 and Quiver-v2.
 *
 * This file is very heavy on the asynchronous code, and uses coroutines frequently for 
 * ease of use and organization.
 */
var Promise = require('bluebird');
var Schedule = require('node-schedule');
var Logging = require('./logging');
var MathHelper = require('./katherine');
var Playground = require('./playground');

// API
var Tradier = require('./APIs/tradier');
var tradier;

// Algorithms
var BuyAlgorithm = require('./algorithms/buy');
var SellAlgorithm = require('./algorithms/sell');
var AllocationAlgorithm = require('./algorithms/allocate');

// Mongoose models
var Stock = require('./models/stock');

// Database objects
var Mongoose = require("mongoose");
Mongoose.Promise = Promise;
var Config = require('../config/tradier');

// The time interval at which trade() is run. One minute = 60000
const TICK_INTERVAL = 15000;

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

// The available cash for the day each day, and the cash remaining for the current day. capital
// doesn't change, but capitalAvailable = capital at the end of each day.
var totalAccountValue;
var tradingCapital;
var netGain = 0;

// The percent loss value of the total portfolio which triggers a TRADECON 3 shutdown
const MAX_LOSS = 0.05;

/**
 * The array of symbols currently being traded.
 */
var activeSymbols = [];

/*
 * This variable will contain a JSON object that looks like this:
 * {
 *    'symbol': [quote1, quote2, quote3, ...],
 *    'symbol2': [quote1, quote2, ...],
 *    ...
 * }
 */
var quoteData = {};

/*
 * This variable will contain a JSON Object that looks like this:
 * {
 *    'symbol': {
 *      purchasePrice: 0.00,
 *      shares: 0,
 *      divorceLower: 0.00
 *    },
 *    ...
 * }
 *
 * Stocks will only exist in this Object if they are currently owned.
 */
var positions = {};

/**
 * An Object that contains information about pending buy orders. This variable will contain 
 * a JSON Object that looks like this:
 * {
 *    'symbol': {
 *      purchasePrice: 0.00,
 *      shares: 0,
 *      divorceLower: 0.00
 *    },
 *    ...
 * }
 */
var pendingBuyOrders = {};

/**
 * Function that the Broker child process enters into; basically runs tests or init() depending 
 * on the environment.
 */
process.on('message', function(argv) {
    Logging.log(argv);
    switch(process.env.NODE_ENV) {
        case 'playground':
            co(function*() {
                yield Playground.playground();
            })();
            break;
        default:
            init();
    }
});

/**
 * This function is run before the process is terminated.
 */
process.on('SIGINT', function() {
    Logging.log("Recieved signal SIGINT");
    clearInterval(midnightRunInterval);
    clearInterval(tradeInterval);
    clearTimeout(openingBellTimeout);
    Mongoose.disconnect(function(err) {
        process.exit(err ? 1 : 0);
    });
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
    tradingHours = yield getTradingHoursAsync();

    // Make sure the market is open today
    if (tradingHours.status === "open") {
        var currentTime = MathHelper.getNumericalTime();
        var marketOpenTime = MathHelper.convertToNumericalTime(tradingHours.open.start);
        var marketCloseTime = MathHelper.convertToNumericalTime(tradingHours.open.end);

        // If the time is between 3am and market open
        if (WAKEUP_TIME <= currentTime && currentTime < marketOpenTime) {
            Logging.log('Market is not open yet; Getting market hours');
            setOpeningBell();
        }
        // If the time is between market open and one hour before market close
        else if (marketOpenTime <= currentTime && currentTime <= (marketCloseTime - 3600000)) {
            openingBellAsync();
        }
        else {
            Logging.log('Market is not open now; Awaiting market open');
        }
    }
    else {
        Logging.log('Market is closed today; Awaiting market open');
    }

    // Set the midnight run interval
    midnightRunInterval = Schedule.scheduleJob('0 3 * * *', midnightRunAsync);
});

/**
 * Run on schedule early every day before trading beings. It pulls down the market hours for the
 * day and sets the interval for the start of day(openingBell) function.
 */
var midnightRunAsync = co(function*(symbol) {
    Logging.log('On another midnight run...');
    tradingHours = yield getTradingHoursAsync();

    if (tradingHours.status === "open") {
        setOpeningBell();
    }
});

/**
 * Syncronously sets the opening bell interval based on tradingHours.
 */
function setOpeningBell() {
    var msTillOpen = MathHelper.convertToNumericalTime(tradingHours.open.start) - MathHelper.getNumericalTime();

    // Run openingBell at tradingHours.open.start, or market open
    openingBellTimeout = setTimeout(openingBell, msTillOpen);
    Logging.log('Ready for market open at ' + tradingHours.open.start);
}

/**
 * This is the function for SoD(start of day). It runs at market open. It performs standard initialization 
 * procedures, including getting symbol lists, managing data storage, and setting function intervals.
 */
var openingBellAsync = co(function*() {
    Logging.log('=== Begin trading for ' + MathHelper.getDate() + ' ===');
    var account = yield tradier.getAccountBalancesAsync();
    totalAccountValue = account.balances.total_equity;
    tradingCapital = AllocationAlgorithm.calculateTradingCapital(totalAccountValue);

    activeSymbols = yield getWatchlistSymbolsAsync();
    for (var index in activeSymbols) {
        var symbol = activeSymbols[index];
        yield initializeDataStorageForSymbolAsync(symbol);
    }

    Logging.log("   TRADECON: " + TRADECON);
    Logging.log("   Hours: " + tradingHours.open.start + " -> " + tradingHours.open.end);
    Logging.log("   Trading Capital($): " + tradingCapital);
    Logging.log("   Total Account Value($): " + totalAccountValue);
    Logging.log("   Symbols: " + activeSymbols);

    tradeInterval = setInterval(trade, TICK_INTERVAL);
    tradeAsync();
});

/**
 * This is the function for EoD(end of day). It runs at market close. It acts as a cleanup function by
 * clearing variables and intervals.
 */
var closingBell = function(finalAccountValue) {
    Logging.log("End of trading day:");
    Logging.log("   TRADECON: " + TRADECON);
    Logging.log("   Net Change($): " + netGain);
    Logging.log("   Total Account Value($): " + finalAccountValue);
    clearInterval(tradeInterval);
    clearTimeout(openingBellTimeout);
    TRADECON = 5;
    netGain = 0;
    totalAccountValue = 0;
    tradingCapital = 0;
    quoteData = {};
    positions = {};
    activeSymbols = [];
    Logging.log('=== End trading for ' + MathHelper.getDate() + ' ===');
};

/**
 * Returns an object containing the trading hours for the current day.
 */
var getTradingHoursAsync = co(function*() {
    var calendar = yield tradier.getMarketCalendarAsync();
    var dateToday = MathHelper.getDate();
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
var getWatchlistSymbolsAsync = co(function*() {
    var watchlist = yield tradier.getDefaultWatchlistAsync();
    var updatedActiveSymbols = [];
    for (index in watchlist.watchlist.items.item) {
        updatedActiveSymbols[index] = watchlist.watchlist.items.item[index].symbol;
    }
    return updatedActiveSymbols;
});

/**
 * Creates a subdocument in the database for the trading day for a certain symbol.
 */
var initializeDataStorageForSymbolAsync = co(function*(symbol) {
    // Search for object with the symbol in the database, and create a new one if it doesn't find one
    var stockObject = yield Stock.findOne({ 'symbol': symbol });
    if (!stockObject) {
        stockObject = new Stock({ 'symbol': symbol });
    }

    // Calculate the Divorce algorithm lower buffer value so we can store it for today
    var quote = yield tradier.getQuotesAsync([symbol]);
    var buffer = yield SellAlgorithm.determineDivorceLowerAsync(quote.quotes.quote.low, quote.quotes.quote.high);

    // Create a subdocument for today's trading
    stockObject.data.push({
        quotes: [],
        MACD: [],
        BBAND: [],
        RSI: [],
        divorceLowerBound: [],
        divorceBuffer: buffer
    });
    yield stockObject.save();

    // Ensure the symbol is in our local object as well
    quoteData[symbol] = [];
});

/**
 * Initiates a TRADECON 3 status. Places sell orders on all existing positions and cancels
 * pending buy orders.
 */
function firesale() {
    Logging.log("Initiating TRADECON 3 operation");
    TRADECON = 3;
    for (symbol in positions) {
        tradier.placeMarketOrderAsync(symbol, "sell", positions[symbol].shares);
    }
    for (symbol in pendingBuyOrders) {
        tradier.cancelOrderAsync(pendingBuyOrders[symbol].id);
    }
    Logging.log("Firesale complete");
}

/**
 * Where the magic happens.
 */
var tradeAsync = co(function*() {
    var updatedSymbols = yield getWatchlistSymbolsAsync();

    // Bbb... Bbbbbb... Butttt Chandler, this isn't the right way to compare strings in JS! We don't need to
    // compare them strictly, because any change in the array should trigger the refresh, so it works.
    if (JSON.stringify(activeSymbols) !== JSON.stringify(updatedSymbols)) {
        for (index in updatedSymbols) {
            // If the symbol isn't in the current list
            if (activeSymbols.indexOf(updatedSymbols[index]) === -1) {
                yield initializeDataStorageForSymbolAsync(updatedSymbols[index]);
                Logging.log("Now actively trading " + updatedSymbols[index]);
            }
        }
        activeSymbols = updatedSymbols;
    }

    // Loss-prevention feature
    if (netGain < -(totalAccountValue * MAX_LOSS)) {
        Logging.log("Daily losses have exceeded MAX_LOSS value of " + (MAX_LOSS*100) + "%; initiating TRADECON 3 status and halting for day");
        var account = yield tradier.getAccountBalancesAsync();
        firesale();
        closingBell(account.balances.total_equity);
        return;
    }

    var quotes = yield tradier.getQuotesAsync(activeSymbols);
    for (var index in activeSymbols) {
        var symbol = activeSymbols[index];
        var quote = quotes.quotes.quote[index].last.toFixed(2);
        var stockObject = yield Stock.findOne({ 'symbol': symbol });

        // Store the new quote price in the local variable and the database
        quoteData[symbol].push(quote);
        stockObject.data[stockObject.data.length - 1].quotes.push(quote);

        var indicators = yield BuyAlgorithm.calculateIndicatorsAsync(quoteData[symbol]);
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

        // If we have a pending buy order for the stock
        if (pendingBuyOrders.hasOwnProperty(symbol)) {
            var orderStatus = yield tradier.getOrderStatusAsync(pendingBuyOrders[symbol].id);
            if (orderStatus.order.status === "filled") {
                // Using the bitwise operator on a value like this will truncate to a whole number
                var quantity = orderStatus.order.quantity | 0;
                var price = orderStatus.order.price.toFixed(2);
                var divorceLowerStart = price - stockObject.data.divorceBuffer;
                positions[symbol] = {
                    purchasePrice: price,
                    shares: quantity,
                    lowerBound: divorceLowerStart,
                    divorceBuffer: stockObject.data.divorceBuffer
                };
                delete pendingBuyOrders[symbol];
                Logging.logBuyOrderFullfilled(symbol, quantity, price);
            }   
        }

        // If we don't already own the stock and there are no pending buy orders for it, check for buy indicators
        if (TRADECON === 5 && !pendingBuyOrders.hasOwnProperty(symbol) && !positions.hasOwnProperty(symbol)) {
            var buySignal = BuyAlgorithm.determineBuy(quote, indicators);
            if (buySignal) {
                var shares = AllocationAlgorithm.getShares(totalAccountValue, tradingCapital, quote);
                if (shares > 0) {
                    var order = yield tradier.placeLimitOrderAsync(symbol, "buy", shares, quote);
                    tradingCapital -= Math.ceil(quote * shares);
                    pendingBuyOrders[symbol] = {
                        id: order.order.id
                    };
                    Logging.logBuyOrder(symbol, shares, quote);
                }
            }
        }
        // If we already own the stock, let the sell algorithm work
        else if ((TRADECON === 5 || TRADECON === 4) && positions.hasOwnProperty(symbol)) {
            var sellSignal = SellAlgorithm.determineSell(quote, positions[symbol]);
            if (sellSignal === true) {
                yield tradier.placeMarketOrderAsync(symbol, "sell", positions[symbol].shares);
                netGain += ((quote - positions[symbol].purchasePrice) * positions[symbol].shares);
                delete positions[symbol];
                Logging.logSellOrder(symbol, positions[symbol].shares, positions[symbol].purchasePrice, quote);
            }
            else {
                var lower = sellSignal;
                positions[symbol].lowerBound = lower;
                divorceLowerValue = lower;
            }
        }

        stockObject.data[stockObject.data.length - 1].MACD.push(indicators.MACD);
        stockObject.data[stockObject.data.length - 1].BBAND.push(indicators.BBAND);
        stockObject.data[stockObject.data.length - 1].RSI.push(indicators.RSI);
        stockObject.data[stockObject.data.length - 1].divorceLowerBound.push(divorceLowerValue);

        yield stockObject.save();
    }

    var currentTime = MathHelper.getNumericalTime();
    var marketCloseTime = MathHelper.convertToNumericalTime(tradingHours.open.end);
    // If the market is closed on this tick
    if (currentTime >= marketCloseTime) {
        var account = yield tradier.getAccountBalancesAsync();
        closingBell(account.balances.total_equity);
        return;
    }
    // If < 10 minutes until market close
    else if (TRADECON !== 6 && TRADECON !== 3 && currentTime >= (marketCloseTime - 600000)) {
        firesale();
    }
    // If < 30 minutes until market close
    else if (currentTime >= (marketCloseTime - 1800000)) {
        // If we don't have any positions or any pending buy orders
        if (Object.keys(positions).length === 0 && Object.keys(pendingBuyOrders).length === 0) {
            TRADECON = 6;
        }
        else {
            TRADECON = 4;
        }
    }
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}