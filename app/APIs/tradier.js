/**
 * Copyright (c) 2016 Chandler Freeman
 */
var Promise = require('bluebird');
var request = require('request');

/**
 * Tradier API interface.
 * 
 * @constructor
 * @param {string} token - Tradier API token.
 * @param {string} account - Tradier account number.
 */
var Tradier = function(account, token) {
  this.account = account;
  this.token = token;
  this.options = {
    headers: {
      'Accept' :                   'application/json',
      'Content-Type' :             'application/x-www-form-urlencoded; charset=utf-8',
      'Connection' :               'keep-alive',
      'Authorization' :            'Bearer ' + this.token
    },
    strictSSL: true,
    json: true
  };
};

/**
 * Some of these partial_endpoints have extensions that are part of the URL, so not all of them are full
 * partial_endpoints.
 */
var partial_endpoints = {
    quotes: 'https://api.tradier.com/v1/markets/quotes',
    accounts: 'https://api.tradier.com/v1/accounts/',
    intraday_status: 'https://api.tradier.com/v1/markets/clock',
    market_calendar: 'https://api.tradier.com/v1/markets/calendar',
    get_default_watchlist: 'https://api.tradier.com/v1/watchlists/default'
};

module.exports = Tradier;

/**
 * Gets account balances.
 */
Tradier.prototype.getAccountBalances = function() {
    var options = this.options;
    options.url = partial_endpoints.accounts + this.account + '/balances';
    options.method = 'GET';
    
    return requestPromise(options);
};

/**
 * Gets all active account positions.
 */
Tradier.prototype.getAccountPositions = function() {
    var options = this.options;
    options.url = partial_endpoints.accounts + this.account + '/positions';
    options.method = 'GET';

    return requestPromise(options);
};

/**
 * Gets all pending orders on an account.
 */
Tradier.prototype.getAccountOrders = function() {
    var options = this.options;
    options.url = partial_endpoints.accounts + this.account + '/orders';
    options.method = 'GET';
    
    return requestPromise(options);
};

/**
 * Gets realtime quote data for the provided symbols.
 *
 * @param {string[]} symbolArray - An array of symbols(strings).
 */
Tradier.prototype.getQuotes = function(symbolArray) {
    var options = this.options;
    var symbolString = "?symbols=";
    for (index in symbolArray) {
        symbolString += "," + symbolArray[index];
    }
    options.url = partial_endpoints.quotes + symbolString;
    options.method = 'GET';
    
    return requestPromise(options);
};

/**
 * Places a limit order.
 *
 * @param {string} symbol - The stock symbol.
 * @param {string} side - Either "buy" or "sell".
 * @param {string} quantity - Number of shares.
 * @param {number} price - The desired price.
 * @param {boolean} [preview=false] - The preview parameter is by default set to false, which means that orders 
    placed using this function will treated as real market orders from the account. For testing purposes, set 
    preview to true, and the API will still return the same information, but without actually placing the order 
    on the market. This is included for testing purposes.
 */
Tradier.prototype.placeLimitOrder = function(symbol, side, quantity, price, preview = false) {
    var options = this.options;
    options.form = {
        class: "equity",
        symbol: symbol,
        duration: "day",
        side: side,
        quantity: quantity,
        type: "limit",
        price: price,
        preview: preview
    }
    options.uri = partial_endpoints.accounts + this.account + '/orders';
    options.method = 'POST';
    
    return requestPromise(options);
};

/**
 * Simple GET endpoints
 */
Tradier.prototype.getIntradayStatus = simpleGet(partial_endpoints.intraday_status);
Tradier.prototype.getMarketCalendar = simpleGet(partial_endpoints.market_calendar);
Tradier.prototype.getDefaultWatchlist = simpleGet(partial_endpoints.get_default_watchlist);

/**
 * Wrapper for a simple GET request
 */
function simpleGet(url) {
    return function() {
        var options = this.options;
        options.url = url;
        options.method = 'GET';

        return requestPromise(options);
    }
}

/**
 * Wrapper for a request callback as a promise
 */
function requestPromise(options) {
    return new Promise(function(resolve, reject) {
        request(options, function(err, httpResponse, body) {
            if (err) {
                return reject(err);
            }
            resolve(body);
        });
    });
}