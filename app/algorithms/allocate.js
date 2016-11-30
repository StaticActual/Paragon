/**
 * Created by Chandler Freeman on 11/28/16.
 */
var Math = require('../math');

/**
 * Returns the number of shares the user can purchase, given the current price.
 */
module.exports.getShares = function(capital, quote) {
    var buyingPowerCents = Math.convertToIntegerCents(capital);
    var quoteCents = Math.convertToIntegerCents(quote);
    var funds = buyingPowerCents / (MAX_OWNED - stocksOwned);

    // Logging.logBuyOrder(stock, shares, price);
    // capitalAvailable -= Math.ceil(quote * shares);
    // var buyTimeNumber = quoteData[stock].length - 1;
    // var lower = (quote - stockObject.data.lower).toFixed(2);
    // tradeData[stock] = {
    //     buyTime: buyTimeNumber,
    //     buyPrice: quote,
    //     shares: shares,
    //     lowerBound: lower
    // };

    // Calculate and return the number of shares
    return Math.floor((funds / quoteCents) / 2);
};