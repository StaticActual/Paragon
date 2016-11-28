/**
 * Created by chandlerfreeman on 3/3/16.
 */
var Chai = require('chai');
var Math = require('../app/Math');
var Logging = require('../app/logging');

exports['test'] = function() {
    Logging.log("***** Testing Math Functions... *****");
    test_convertToIntegerCents();
    test_convertToStringDollars();
    test_convertToFloatDollars();
};

function test_convertToIntegerCents() {
  var assert = Chai.assert;
  assert.equal(Math.convertToIntegerCents(0.001), 0);
  assert.equal(Math.convertToIntegerCents(0.005), 1);
  assert.equal(Math.convertToIntegerCents(0.009), 1);
  assert.equal(Math.convertToIntegerCents(0.01), 1);
  assert.equal(Math.convertToIntegerCents(0.27), 27);
  assert.equal(Math.convertToIntegerCents(0.50), 50);
  assert.equal(Math.convertToIntegerCents(0.75), 75);
  assert.equal(Math.convertToIntegerCents(1), 100);
  assert.equal(Math.convertToIntegerCents(1.0), 100);
  assert.equal(Math.convertToIntegerCents(1.00), 100);
  assert.equal(Math.convertToIntegerCents(1.001), 100);
  assert.equal(Math.convertToIntegerCents(1.005), 100);
  assert.equal(Math.convertToIntegerCents(1.01), 101);
  assert.equal(Math.convertToIntegerCents(2.56653), 257);
  assert.equal(Math.convertToIntegerCents(2.36653), 237);
  assert.equal(Math.convertToIntegerCents(200.36653), 20037);
  assert.equal(Math.convertToIntegerCents(200.32), 20032);
  assert.equal(Math.convertToIntegerCents(2.56), 256);
  assert.equal(Math.convertToIntegerCents(24.3), 2430);
  assert.equal(Math.convertToIntegerCents(24.30), 2430);
  assert.equal(Math.convertToIntegerCents(7), 700);
  Logging.log("test_convertToIntegerCents [OK]");
};

function test_convertToStringDollars() {
  var assert = Chai.assert;
  assert.equal(Math.convertToStringDollars(0), '0.00');
  assert.equal(Math.convertToStringDollars(11), '0.11');
  assert.equal(Math.convertToStringDollars(21), '0.21');
  assert.equal(Math.convertToStringDollars(10), '0.10');
  assert.equal(Math.convertToStringDollars(201), '2.01');
  assert.equal(Math.convertToStringDollars(212), '2.12');
  assert.equal(Math.convertToStringDollars(2123), '21.23');
  assert.equal(Math.convertToStringDollars(21987), '219.87');
  Logging.log("test_convertToStringDollars [OK]");
};

function test_convertToFloatDollars() {
  var assert = Chai.assert;
  assert.equal(Math.convertToFloatDollars(0), 0.00);
  assert.equal(Math.convertToFloatDollars(11), 0.11);
  assert.equal(Math.convertToFloatDollars(21), 0.21);
  assert.equal(Math.convertToFloatDollars(10), 0.10);
  assert.equal(Math.convertToFloatDollars(201), 2.01);
  assert.equal(Math.convertToFloatDollars(212), 2.12);
  assert.equal(Math.convertToFloatDollars(2123), 21.23);
  assert.equal(Math.convertToFloatDollars(21987), 219.87);
  Logging.log("test_convertToFloatDollars [OK]");
};