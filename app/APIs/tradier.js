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

  // FOR THE LOVE OF ALL THINGS GODLY
  // Please remember that the 'let reqOptions = Object.assign({}, this.options);' line in each method
  // only creates a shallow copy of the options object. So everything in the 'headers' key is passed
  // by reference. This is ok since it's a safe bet that we won't modify the headers on a per-request
  // basis. I hate this f***ing language sometimes.
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
Tradier.prototype.getAccountBalancesAsync = function() {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.url = partial_endpoints.accounts + this.account + '/balances';
    reqOptions.method = 'GET';
    
    return requestPromise(reqOptions);
};

/**
 * Gets all active account positions.
 */
Tradier.prototype.getAccountPositionsAsync = function() {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.url = partial_endpoints.accounts + this.account + '/positions';
    reqOptions.method = 'GET';
    
    return requestPromise(reqOptions);
};

/**
 * Get status of specific order by id.
 */
Tradier.prototype.getOrderStatusAsync = function(id) {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.url = partial_endpoints.accounts + this.account + '/orders/' + id;
    reqOptions.method = 'GET';
    
    return requestPromise(reqOptions);
};

/**
 * Cancel an order by id.
 */
Tradier.prototype.cancelOrderAsync = function(id) {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.url = partial_endpoints.accounts + this.account + '/orders/' + id;
    reqOptions.method = 'DELETE';
    
    return requestPromise(reqOptions);
};

/**
 * Gets all pending orders on an account.
 */
Tradier.prototype.getAccountOrdersAsync = function() {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.url = partial_endpoints.accounts + this.account + '/orders';
    reqOptions.method = 'GET';
    
    return requestPromise(reqOptions);
};

/**
 * Gets realtime quote data for the provided symbols.
 *
 * @param {string[]} symbolArray - An array of symbols(strings).
 */
Tradier.prototype.getQuotesAsync = function(symbolArray) {
    let reqOptions = Object.assign({}, this.options);
    var symbolString = "?symbols=";
    for (index in symbolArray) {
        symbolString += "," + symbolArray[index];
    }
    reqOptions.url = partial_endpoints.quotes + symbolString;
    reqOptions.method = 'GET';
    
    return requestPromise(reqOptions);
};

/**
 * Places a market order.
 *
 * @param {string} symbol - The stock symbol.
 * @param {string} side - Either "buy" or "sell".
 * @param {string} quantity - Number of shares.
 * @param {boolean} [preview=false] - The preview parameter is by default set to false, which means that orders 
    placed using this function will treated as real market orders from the account. For testing purposes, set 
    preview to true, and the API will still return the same information, but without actually placing the order 
    on the market. This is included for testing purposes.
 */
Tradier.prototype.placeMarketOrderAsync = function(symbol, side, quantity, preview = false) {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.form = {
        class: "equity",
        symbol: symbol,
        duration: "day",
        side: side,
        quantity: quantity,
        type: "market",
        preview: preview
    }
    reqOptions.uri = partial_endpoints.accounts + this.account + '/orders';
    reqOptions.method = 'POST';
    
    return requestPromise(reqOptions);
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
Tradier.prototype.placeLimitOrderAsync = function(symbol, side, quantity, price, preview = false) {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.form = {
        class: "equity",
        symbol: symbol,
        duration: "day",
        side: side,
        quantity: quantity,
        type: "limit",
        price: price,
        preview: preview
    }
    reqOptions.uri = partial_endpoints.accounts + this.account + '/orders';
    reqOptions.method = 'POST';
    
    return requestPromise(reqOptions);
};

/**
 * Gets the default Tradier watchlist.
 */
Tradier.prototype.getDefaultWatchlistAsync = function() {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.url = partial_endpoints.get_default_watchlist;
    reqOptions.method = 'GET';
    
    return requestPromise(reqOptions);
};

/**
 * Gets the intraday market status.
 */
Tradier.prototype.getMarketCalendarAsync = function() {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.url = partial_endpoints.market_calendar;
    reqOptions.method = 'GET';
    
    return requestPromise(reqOptions);
};

/**
 * Gets the current market calendar for month.
 */
Tradier.prototype.getIntradayStatusAsync = function() {
    let reqOptions = Object.assign({}, this.options);
    reqOptions.url = partial_endpoints.intraday_status;
    reqOptions.method = 'GET';
    
    return requestPromise(reqOptions);
};

/**
 * Wrapper for a request callback as a promise
 */
function requestPromise(reqOptions) {
    return new Promise(function(resolve, reject) {
        request(reqOptions, function(err, httpResponse, body) {
            if (err) {
                return reject(err);
            }
            resolve(body);
        });
    });
}