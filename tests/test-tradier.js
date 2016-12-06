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
    test_quotesAsync();
    test_market_timingAsync();
    test_watchlistAsync();

    // These tests *MUST* be run in order, because the test_orders functions actually places a
    // fake order, but then the test_account will not return the correct positions list. So don't 
    // mess with it.
    yield test_accountAsync();
    yield test_ordersAsync();
});

// Tests endpoints.quotes
var test_quotesAsync = co(function*() {
    var assert = Chai.assert;

    var quotes = yield tradier.getQuotesAsync(["AUY","AAPL"]);
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
var test_accountAsync = co(function*() {
    var assert = Chai.assert;

    var account_balances = yield tradier.getAccountBalancesAsync();
    assert.deepProperty(account_balances, 'balances.total_equity');
    assert.deepProperty(account_balances, 'balances.account_number');
    assert.deepProperty(account_balances, 'balances.account_type');
    assert.deepProperty(account_balances, 'balances.cash');
    assert.deepProperty(account_balances, 'balances.cash.cash_available');
    assert.deepProperty(account_balances, 'balances.cash.unsettled_funds');
    Logging.log("test_account_balances [OK]");

    var account_positions = yield tradier.getAccountPositionsAsync();
    assert.property(account_positions, 'positions');
    Logging.log("test_account_positions [OK]");
});

// Tests endpoints.account_orders
var test_ordersAsync = co(function*() {
    var assert = Chai.assert;
    
    var orders = yield tradier.getAccountOrdersAsync();
    assert.property(orders, 'orders');
    Logging.log("test_get_orders [OK]");

    var market_order = yield tradier.placeMarketOrderAsync("AUY", "buy", 5, true);
    assert.deepProperty(market_order, 'order.cost');
    assert.deepProperty(market_order, 'order.class');
    assert.deepProperty(market_order, 'order.quantity');
    assert.deepProperty(market_order, 'order.side');
    assert.deepProperty(market_order, 'order.symbol');
    assert.deepProperty(market_order, 'order.type');
    Logging.log("test_place_market_order [OK]");

    var limit_order = yield tradier.placeLimitOrderAsync("AUY", "buy", 5, 3.00, true);
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
var test_market_timingAsync = co(function*() {
    var assert = Chai.assert;
    
    var intraday_status = yield tradier.getIntradayStatusAsync();
    assert.deepProperty(intraday_status, 'clock.state');
    assert.deepProperty(intraday_status, 'clock.date');
    assert.deepProperty(intraday_status, 'clock.next_state');
    assert.deepProperty(intraday_status, 'clock.next_change');
    Logging.log("test_intraday_status [OK]");

    var market_calendar = yield tradier.getMarketCalendarAsync();
    assert.deepProperty(market_calendar, 'calendar.month');
    assert.deepProperty(market_calendar, 'calendar.year');
    assert.deepProperty(market_calendar, 'calendar.days.day[0].date');
    assert.deepProperty(market_calendar, 'calendar.days.day[0].status');
    Logging.log("test_market_calendar [OK]");
});

// Tests endpoints.get_default_watchlist
var test_watchlistAsync = co(function*() {
    var assert = Chai.assert;
    var watchlist = yield tradier.getDefaultWatchlistAsync();
    assert.deepProperty(watchlist, 'watchlist.name');
    assert.deepProperty(watchlist, 'watchlist.public_id');
    Logging.log("test_watchlist [OK]");
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}