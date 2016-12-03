/**
 * Created by chandlerfreeman on 3/3/16.
 */
var Chai = require('chai');
var MathHelper = require('../app/katherine');
var Logging = require('../app/logging');

exports['test'] = function() {
    Logging.log("***** Testing MathHelper Functions... *****");
    test_convertToIntegerCents();
    test_convertToStringDollars();
    test_convertToFloatDollars();
};

function test_convertToIntegerCents() {
  var assert = Chai.assert;
  assert.equal(MathHelper.convertToIntegerCents(0.001), 0);
  assert.equal(MathHelper.convertToIntegerCents(0.005), 1);
  assert.equal(MathHelper.convertToIntegerCents(0.009), 1);
  assert.equal(MathHelper.convertToIntegerCents(0.01), 1);
  assert.equal(MathHelper.convertToIntegerCents(0.27), 27);
  assert.equal(MathHelper.convertToIntegerCents(0.50), 50);
  assert.equal(MathHelper.convertToIntegerCents(0.75), 75);
  assert.equal(MathHelper.convertToIntegerCents(1), 100);
  assert.equal(MathHelper.convertToIntegerCents(1.0), 100);
  assert.equal(MathHelper.convertToIntegerCents(1.00), 100);
  assert.equal(MathHelper.convertToIntegerCents(1.001), 100);
  assert.equal(MathHelper.convertToIntegerCents(1.005), 100);
  assert.equal(MathHelper.convertToIntegerCents(1.01), 101);
  assert.equal(MathHelper.convertToIntegerCents(2.56653), 257);
  assert.equal(MathHelper.convertToIntegerCents(2.36653), 237);
  assert.equal(MathHelper.convertToIntegerCents(200.36653), 20037);
  assert.equal(MathHelper.convertToIntegerCents(200.32), 20032);
  assert.equal(MathHelper.convertToIntegerCents(2.56), 256);
  assert.equal(MathHelper.convertToIntegerCents(24.3), 2430);
  assert.equal(MathHelper.convertToIntegerCents(24.30), 2430);
  assert.equal(MathHelper.convertToIntegerCents(7), 700);
  Logging.log("test_convertToIntegerCents [OK]");
};

function test_convertToStringDollars() {
  var assert = Chai.assert;
  assert.equal(MathHelper.convertToStringDollars(0), '0.00');
  assert.equal(MathHelper.convertToStringDollars(11), '0.11');
  assert.equal(MathHelper.convertToStringDollars(21), '0.21');
  assert.equal(MathHelper.convertToStringDollars(10), '0.10');
  assert.equal(MathHelper.convertToStringDollars(201), '2.01');
  assert.equal(MathHelper.convertToStringDollars(212), '2.12');
  assert.equal(MathHelper.convertToStringDollars(2123), '21.23');
  assert.equal(MathHelper.convertToStringDollars(21987), '219.87');
  Logging.log("test_convertToStringDollars [OK]");
};

function test_convertToFloatDollars() {
  var assert = Chai.assert;
  assert.equal(MathHelper.convertToFloatDollars(0), 0.00);
  assert.equal(MathHelper.convertToFloatDollars(11), 0.11);
  assert.equal(MathHelper.convertToFloatDollars(21), 0.21);
  assert.equal(MathHelper.convertToFloatDollars(10), 0.10);
  assert.equal(MathHelper.convertToFloatDollars(201), 2.01);
  assert.equal(MathHelper.convertToFloatDollars(212), 2.12);
  assert.equal(MathHelper.convertToFloatDollars(2123), 21.23);
  assert.equal(MathHelper.convertToFloatDollars(21987), 219.87);
  Logging.log("test_convertToFloatDollars [OK]");
};