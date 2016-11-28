/**
 * Created by Chandler Freeman on 3/3/16.
 * Copyright 2016
 *
 * This file was written to act as an interface between the Broker and the Robinhood API. It
 * handles errors and other instances specific to Quiver. This is a good way to modularize,
 * and makes sure the Robinhood API client can be used by other projects.
 */
var Promise = require('bluebird');
var Math = require('./math');
var Logging = require('./logging');

module.exports = {};

/**
 * Places a market order.
 *
 * @param {side}	    String			  'buy' or 'sell'
 * @param {stock}			String				The stock ticker.
 * @param {quote}			Float				  The current value of the stock.
 * @param {shares}		Int			      The number of shares.
 */
module.exports.marketOrder = Promise.coroutine(function*(robinhoodUser, side, stock, quote, shares) {
  var order = {};
  order.account = yield robinhoodUser.getAccount();
  if (!order.account.hasOwnProperty('buying_power')) {
    Logging.log(Math.getTimestamp() + ' -> Retrieving Robinhood account failed! Skipping' +
        ' trade: ');
    Logging.log(order.account);
    return;
  }
  order.instrument = yield robinhoodUser.getInstrument(stock);
  if (!order.instrument) {
    Logging.log(Math.getTimestamp() + ' -> Retrieving instrument for ' + stock + ' failed!' +
        ' Skipping trade...');
    return;
  }
  order.bidprice = quote;
  order.quantity = shares;
  order.side = side;

  var orderStatus = yield robinhoodUser.marketOrder(order);
  if (orderStatus.state === 'confirmed' || orderStatus.state === 'unconfirmed') {
    return orderStatus.state;
  }
  else {
    Logging.log(Math.getTimestamp() + ' -> Order failed for ' + stock + ': (' + [side, quote, shares].join(', ') + ')');
  }
});

/**
 * Gets buying power for the Robinhood user.
 */
module.exports.getBuyPower = Promise.coroutine(function*(robinhoodUser) {
  var account = yield robinhoodUser.getAccount();
  if (!account.buying_power) {
    Logging.log(Math.getTimestamp() + ' -> Retrieving Robinhood account failed! Skipping...');
    Logging.log(account);
    return;
  }
  return parseFloat(account.buying_power);
});

/**
 * Gets stats for a stock, such as highs, lows, and volume.
 */
module.exports.getFundamentals = Promise.coroutine(function*(robinhoodUser, stock) {
  var fundamentals = yield robinhoodUser.getFundamentals(stock);
  if (!fundamentals) {
    Logging.log(Math.getTimestamp() + ' -> Retrieving fundamentals for '  + stock + ' failed!' +
        ' Skipping...');
    return;
  }
  return fundamentals;
});