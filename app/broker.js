/**
 * Created by Chandler Freeman on 2/26/16.
 * Adapted from Quiver 1.0.
 *
 * This file is very heavy on the asynchronous code, and uses Promises
 * frequently for ease of use and organization.
 */
var Promise = require('bluebird');
var Indicators = require('./indicators');
var RobinhoodInterface = require('./interface');
var Logging = require('./logging');
var Math = require('./math');

// API
var Tradier = require('./APIs/tradier.js');

// Mongoose models
var Stock = require('./models/stock');

// Create our database object.
var Mongoose = require("mongoose");
var Config = require('../config/tradier.js');

// The time interval at which trader() is run. One minute = 60000.
const TRADE_INTERVAL = 60000;

// The required number of quotes before trading begins.
const REQUIRED_QUOTES = 80;

// Algorithm constants
const RSICutoff = 70;

/*
 * @var stockData will contain a JSON object that looks like this:
 * {
 *    'symbol': [quote1, quote2, quote3, ...],
 *    'symbol2': [quote1, quote2, ...],
 *    ...
 * }
 */
var stockData = {};

/*
 * @var tradeData will contain a JSON object that looks like this:
 * {
 *    'symbol': {
 *      purchasePrice: 0.00,
 *      shares: 0,
 *      stopLoss: 0.00,
 *      profitTarget: 0.00,
 *      profitTargetHit: false
 *    },
 *    ...
 * }
 *
 * Stocks will only exist in this Object if they have been purchased.
 */
var tradeData = {};
var stocksOwned = 0;

// The available cash for the day each day, and the cash remaining for the current day. capital
// doesn't change, but capitalAvailable = capital at the end of each day.
var capital;
var capitalAvailable;

// trader() is run based on TRADER_INTERVAL.
var tradeInterval = null;

/*
 Each time the updateMarketClock() function is run, it gets a value for the next time
 the function should be run and sets this variable to a setTimeout function. For example, when
//  updateMarketClock() is run at 4:00pm on a weekday, it might get a value saying next market
 change is at 8:00am the following morning, so it will set the timeout function to run
 updateMarketClock() again at 8:00am, which will update the interval to run at 9:30am, and so on.
 A general week day cycle looks like this:

 8:00 -> premarket
 9:30 -> market is open(starts trade() interval)
 4:00 -> afterhours
 6:30 -> market is closed

 */
var marketClockInterval;

// The next status of the market. Possible values are premarket, open, postmarket, closed and null.
var nextMarketState = null;

// The instance of Robinhood that will be used to make trades.
var robinhoodUser;

// Function that the Broker child process enters into; basically runs tests or init() depending
// on the environment.
process.on('message', function(argv) {
    Logging.log(argv);
    // switch(process.env.NODE_ENV) {
    //     case 'testing':
    //         testing();
    //         break;
    //     case 'playground':
    //         playground();
    //         break;
    //     default:
    //         init();
    // }
});

/**
 * Initialize the application by connecting to the database and loading Robinhood account and trading information.
 * @param {{NODE_DB}} process.env
 */
var init = Promise.coroutine(function*() {
    Mongoose.connect(process.env.NODE_DB);
    Logging.log('DATABASE [OK]');
    robinhoodUser = new Robinhood(Config[process.env.NODE_RHACCOUNT].token);

    yield updateMarketClock();
});

/**
 * Loads the stocks from the config file and sets up sub documents in the database.
 */
var loadStockData = Promise.coroutine(function*() {
    Logging.log('Loading stock data...');
    for (var i in stockList.stocks) {
        var stock = stockList.stocks[i];
        var stockObject = yield Stock.findOne({ 'symbol': stock });
        if (!stockObject) {
            stockObject = new Stock({ 'symbol': stock });
        }

        var lower = yield calculateLower(stock);
        stockObject.data.push({
            quotes: [],
            MACD: [],
            BBAND: [],
            RSI: [],
            tradeHistory: [],
            lower: lower
        });
        yield stockObject.save();
        stockData[stockList.stocks[i]] = [];
    }
    tradeData = {};
});

// Updates the broker using the market state. Start trading when open, stop when closed, etc.
var updateMarketClock = Promise.coroutine(function*() {
    var intradayStatus = yield new Tradier().getMarketClock();
    if (typeof intradayStatus == 'undefined') {
        return;
    }

    Logging.logMarketEvent('Market status: ' + intradayStatus.clock.state);
    if (nextMarketState === 'open' && tradeInterval === null) {
        yield loadStockData();
        Logging.log('Collecting initial data...');
        tradeInterval = setInterval(trade, TRADE_INTERVAL);
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

// The most important function for the broker. This function contains the algorithm that buys and
// sells, and also tracks and saves information to the database that can later be retrieved using
// the Quiver API.
var trade = Promise.coroutine(function*() {
    for (var stock in stockData) {

        // Retrieve database stock object
        var stockObject = yield Stock.findOne({ 'symbol': stock });

        // Retrieve quote
        var quote = yield RobinhoodInterface.getQuote(stock);
        if (!quote) {
            stockData[stock].push(null);
            stockObject.data[stockObject.data.length - 1].quotes.push(null);
            stockObject.data[stockObject.data.length - 1].MACD.push(null);
            stockObject.data[stockObject.data.length - 1].BBAND.push(null);
            stockObject.data[stockObject.data.length - 1].RSI.push(null);

            /* Save the stock object to the db */
            yield stockObject.save();
            continue;
        }

        // Store quote in database object for this session
        stockData[stock].push(quote);
        stockObject.data[stockObject.data.length - 1].quotes.push(quote);

        // Stock data point
        var MACD, BBAND, RSI;

        // If the number of required data points has been met
        if (stockData[stock].length > REQUIRED_QUOTES) {

            /* Calculate our indicators for the algorithm */
            MACD = yield Indicators.MACD(stockData[stock]);
            BBAND = yield Indicators.BBANDS(stockData[stock]);
            RSI = yield Indicators.RSI(stockData[stock]);

            /* Store the indicators in the database object */
            stockObject.data[stockObject.data.length - 1].MACD.push(MACD);
            stockObject.data[stockObject.data.length - 1].BBAND.push(BBAND);
            stockObject.data[stockObject.data.length - 1].RSI.push(RSI);

            // If we don't own the stock, look to buy
            if (!tradeData.hasOwnProperty(stock) && stocksOwned < MAX_OWNED) {

                /* If the indicator test passes, we buy */
                if (MACD.MACD > 0 && MACD.MACD > MACD.signal && BBAND.high > quote && RSI >= RSICutoff) {

                    // Calculate the total number of shares that can be purchased
                    var shares = calculateMaxShares(quote);
                    if (shares > 0) {

                        /* Place the buy order */
                        var buyOrder = yield RobinhoodInterface.marketOrder(robinhoodUser, 'buy', stock, quote, shares);
                        if (!buyOrder) {
                            continue;
                        }

                        Logging.logBuyOrder(stock, shares, price);
                        capitalAvailable -= Math.ceil(quote * shares);
                        var buyTimeNumber = stockData[stock].length - 1;
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
                    tradeHistory[tradeHistory.length - 1].sellTime = stockData[stock].length - 1;
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
 * Returns the number of shares the user can purchase, given the current price.
 */
function calculateMaxShares(quote) {
    var buyingPowerCents = Math.convertToIntegerCents(capitalAvailable);
    var quoteCents = Math.convertToIntegerCents(quote);
    var funds = buyingPowerCents / (MAX_OWNED - stocksOwned);

    // Calculate and return the number of shares.
    return Math.floor((funds / quoteCents) / 2);
}

/**
 * Returns the calculated start value for the Divorce algorithm. It returns as a 2-decimal float
 * number. For example, the function would return 0.02 if the start point for the Divorce algorithm
 * is supposed to be 2 cents lower than the share price.
 */
var calculateLower = Promise.coroutine(function*(stock) {
    var fundamentals = yield RobinhoodInterface.getFundamentals(robinhoodUser, stock);
    if (!fundamentals) {
        return;
    }
    var ADR = yield Indicators.ADR(fundamentals.low, fundamentals.high);
    var lower = 0.0485 * ADR + 0.01;
    return lower.toFixed(2);
});

/**
 * A method that performs End-to-End / White Box Testing on Quiver v2.
 */
var testing = Promise.coroutine(function*() {
    Logging.log('End-to-End/White Box Testing \n');
    robinhoodUser = new Robinhood(Config[process.env.NODE_RHACCOUNT].token);

    var stockData = {
        'AUY': [1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.40, 2.30, 3.10, 4.30, 5.40, 6.30, 7.40, 8.30, 9.40,
            9.50, 9.40, 10.30, 10.40, 11.30, 11.40, 12.30, 13.47, 14.56, 15.20, 16.78],
        'NM': [12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40,
            12.30, 13.40, 12.30, 13.40, 12.30, 11.40, 10.65, 9.10, 7.87, 9.40, 11.30, 12.10, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40,
            12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.47, 14.56, 15.20, 16.78],
        'ONE': [12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30,
            12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30]
    };

    /* calculateSellPoints */
    Logging.log('Testing calculateLower()');
    var stocks = stockList.stocks;
    for (var stock in stocks) {
        var quote = yield RobinhoodInterface.getQuote(stocks[stock]);
        var lower = yield calculateLower(stocks[stock]);
        var value = (quote - (yield calculateLower(stocks[stock]))).toFixed(2);
        Logging.log(stocks[stock] + ' @ ' + quote + ':' + lower + ' = ' + value);
    }

    /* getBuyPower() */
    Logging.log('Testing getBuyPower()');
    Logging.log(yield RobinhoodInterface.getBuyPower(robinhoodUser));

    /* robinhoodUser.getAccount() */
    Logging.log('Testing Robinhood.getAccount()');
    Logging.log(yield robinhoodUser.getAccount());

    Logging.log('Tests complete');
    process.exit(0);
});


/**
 * This method tests acts as a testing ground for new code. It can be used to tune algorithms or while developing
 * new functions.
 */
var playground = Promise.coroutine(function*() {
    Logging.log('Playground \n');

    /* updateMarketClock */
    var intradayStatus = yield new Tradier().getMarketClock();
    Logging.logObject(intradayStatus);

    var marketCalendar = yield new Tradier().getMarketCalendar();
    // Logging.logObject(marketCalendar);
    // Logging.logObject(marketCalendar.calendar);
    for (var i in marketCalendar.calendar.days.day) {
        // Logging.log(marketCalendar.calendar.days.day[dateObjectNumber].date);
        var day = marketCalendar.calendar.days.day[i];
        if (day.date === Math.getDate()) {
            Logging.log(day.date);
            Logging.log(day.status);
        }
    }

    Logging.log('Playground complete');
    process.exit(0);
});
