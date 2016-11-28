/**
 * Copyright Chandler Freeman 2016.
 */
var Promise = require('bluebird');
var cp = require('child_process');
var Logging = require('./app/logging');

Logging.logApplicationStartup();

if (process.env.NODE_ENV === "testing") {
    runTests();
} else {
    // Fork the 'broker' process as a child.
    var broker = cp.fork('./app/broker.js');
    broker.on('args', function() {});
    broker.send('BROKER [OK]');
}

/**
 * Run me some tests!
 */
function runTests() {
    var math_test = require('./tests/test-math');
    var traider_test = require('./tests/test-tradier');
    var indicator_test = require('./tests/test-indicators');

    Promise.coroutine(function*() {
        math_test.test();
        yield traider_test.test();
        yield indicator_test.test();
    })();
}