var Chai = require('chai');
var Promise = require('bluebird');
var Config = require('../config/tradier');
var Logging = require('../app/logging');
var Tradier = require('../app/APIs/tradier');

var tradier;
exports['test'] = co(function*() {
    Logging.log("***** Testing Tradier API... *****");
    tradier = new Tradier(Config.account, Config.token);

    // The tests are run asyncronously, so they may finish in different orders. This is done
    // to save .00000003 nanoseconds of testing time.
    test_quotes();
    test_market_timing();

    // These tests *MUST* be run in order, because the test_orders functions actually places a
    // fake order, but then the test_account will not return the correct positions list. So don't 
    // mess with it.
    yield test_account();
    yield test_orders();
});

// Tests endpoints.quotes
var test_quotes = co(function*() {
    var assert = Chai.assert;

    var quotes = yield tradier.getQuotes(["AUY","AAPL"]);
    assert.deepProperty(quotes, 'quotes.quote[0].symbol');
    assert.deepProperty(quotes, 'quotes.quote[0].type');
    assert.deepProperty(quotes, 'quotes.quote[0].last');
    assert.deepProperty(quotes, 'quotes.quote[0].volume');
    assert.deepProperty(quotes, 'quotes.quote[0].trade_date');
    assert.deepProperty(quotes, 'quotes.quote[1].symbol');
    assert.deepProperty(quotes, 'quotes.quote[1].type');
    assert.deepProperty(quotes, 'quotes.quote[1].last');
    assert.deepProperty(quotes, 'quotes.quote[1].volume');
    assert.deepProperty(quotes, 'quotes.quote[1].trade_date');
    Logging.log("test_quotes [OK]");
});

// Tests endpoints.account_balances and endpoints.account_positions
var test_account = co(function*() {
    var assert = Chai.assert;

    var account_balances = yield tradier.getAccountBalances();
    assert.deepProperty(account_balances, 'balances.total_equity');
    assert.deepProperty(account_balances, 'balances.account_number');
    assert.deepProperty(account_balances, 'balances.account_type');
    assert.deepProperty(account_balances, 'balances.cash');
    assert.deepProperty(account_balances, 'balances.cash.cash_available');
    assert.deepProperty(account_balances, 'balances.cash.unsettled_funds');
    Logging.log("test_account_balances [OK]");

    var account_positions = yield tradier.getAccountPositions();
    assert.property(account_positions, 'positions');
    Logging.log("test_account_positions [OK]");
});

// Tests endpoints.account_orders
var test_orders = co(function*() {
    var assert = Chai.assert;
    
    var orders = yield tradier.getAccountOrders();
    // assert.property(orders, 'orders');
    Logging.log("test_get_orders [OK]");

    var limit_order = yield tradier.placeLimitOrder("AUY", "buy", 5, 3.00, true);
    assert.deepProperty(limit_order, 'order.cost');
    assert.deepProperty(limit_order, 'order.class');
    assert.deepProperty(limit_order, 'order.price');
    assert.deepProperty(limit_order, 'order.quantity');
    assert.deepProperty(limit_order, 'order.side');
    assert.deepProperty(limit_order, 'order.symbol');
    assert.deepProperty(limit_order, 'order.type');
    Logging.log("test_place_limit_order [OK]");
});

// Tests endpoints.intraday_status and endpoints.market_calendar
var test_market_timing = co(function*() {
    var assert = Chai.assert;
    
    var intraday_status = yield tradier.getIntradayStatus();
    assert.deepProperty(intraday_status, 'clock.state');
    assert.deepProperty(intraday_status, 'clock.date');
    assert.deepProperty(intraday_status, 'clock.next_state');
    assert.deepProperty(intraday_status, 'clock.next_change');
    Logging.log("test_intraday_status [OK]");

    var market_calendar = yield tradier.getMarketCalendar();
    assert.deepProperty(market_calendar, 'calendar.month');
    assert.deepProperty(market_calendar, 'calendar.year');
    assert.deepProperty(market_calendar, 'calendar.days.day[0].date');
    assert.deepProperty(market_calendar, 'calendar.days.day[0].status');
    Logging.log("test_market_calendar [OK]");
});

// Tests endpoints.get_default_watchlist
var test_watchlist = co(function*() {
    var assert = Chai.assert;
    
    var orders = yield tradier.getAccountOrders();
    assert.property(orders, 'orders');
    Logging.log("test_watchlist [OK]");
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}