/**
 * Created by chandlerfreeman on 3/4/16.
 */
var Promise = require('bluebird');
var Chai = require('chai');
var Logging = require('../app/logging');
var indicators = require('../app/indicators');

exports['test'] = co(function*() {
    Logging.log("***** Testing Talib... *****");
    yield test_BBANDS();
    yield test_MACD();
    yield test_RSI();
    yield test_ADR();
});

var stockData = {
  'AUY': [1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.40, 2.30, 3.10, 4.30, 5.40, 6.30, 7.40, 8.30, 9.40,
    9.50, 9.40, 10.30, 10.40, 11.30, 11.40, 12.30, 13.47, 14.56, 15.20, 16.78],
  'NM': [12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40,
    12.30, 13.40, 12.30, 13.40, 12.30, 11.40, 10.65, 9.10, 7.87, 9.40, 11.30, 12.10, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40,
    12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30, 13.47, 14.56, 15.20, 16.78],
  'ONE': [12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30,
    12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 12.30, 13.40, 15.60, 12.30, 13.40, 12.30, 13.40, 12.30, 13.40, 12.30]
};

var test_BBANDS = co(function*() {
  var assert = Chai.assert;
  var bbands = yield indicators.BBANDS(stockData['NM']);
  assert.equal(bbands.high, 16.1827);
  assert.equal(bbands.mid, 13.5675);
  assert.equal(bbands.low, 10.9523);
  Logging.log("test_BBANDS [OK]");
});

var test_MACD = co(function*() {
  var assert = Chai.assert;
  var macd = yield indicators.MACD(stockData['NM']);
  assert.equal(macd.MACD, 0.6641);
  assert.equal(macd.signal, 0.2410);
  Logging.log("test_MACD [OK]");
});

var test_RSI = co(function*() {
  var assert = Chai.assert;
  var rsi = yield indicators.RSI(stockData['NM']);
  assert.equal(rsi, 72.3409);
  Logging.log("test_RSI [OK]");
});

var test_ADR = co(function*() {
  var assert = Chai.assert;
  var adr = yield indicators.ADR(3.08, 3.25);
  assert.equal(adr, 0.09);
  Logging.log("test_ADR [OK]");
});

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}