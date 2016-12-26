/**
 * Created by chandlerfreeman on 12/26/16.
 */
var Promise = require('bluebird');
var Logging = require('../app/logging');
var fse = require('fs-extra')
var stringify = require('csv-stringify');

// Mongoose models
var Stock = require('../app/models/stock');

// Database objects
var Mongoose = require("mongoose");
Mongoose.Promise = Promise;
var Config = require('../config/tradier');

exports['exportCSV'] = co(function*() {
    Logging.log("Running CSV export tool...");
    Mongoose.connect(process.env.NODE_DB);
    Logging.log("   DATABASE [OK]");
    Logging.log("   RETRIEVING RECORDS... ");
    var stocks = yield Stock.find({});
    Logging.log("   RECORDS [OK]");
    Logging.log("   GENERATING OUTPUT... ");
    fse.emptyDirSync('exported');
    for (var index in stocks) {
        var symbolData = stocks[index];
        Logging.log('   ' + symbolData.symbol);
        for (var day = 0; day < symbolData.data.length; day++) {
            var lines = [];
            var rowCount = symbolData.data[day].quotes.length;

            // CSV headers
            var columns = {
                quotes: 'quotes',
                divorce: 'divorce',
                BBANDLow: 'BBAND Low',
                BBANDMid: 'BBAND Mid',
                BBANDHigh: 'BBAND High',
                MACD: 'MACD',
                MACDSignal: 'MACD Signal',
                RSI: 'RSI'
            };

            for (var rowNumber = 0; rowNumber < rowCount; rowNumber++) {
                var line = [];
                line.push(symbolData.data[day].quotes[rowNumber]);
                line.push(symbolData.data[day].divorceLowerBound[rowNumber]);

                if (symbolData.data[day].BBAND[rowNumber] !== null) {
                    line.push(symbolData.data[day].BBAND[rowNumber].low);
                    line.push(symbolData.data[day].BBAND[rowNumber].mid);
                    line.push(symbolData.data[day].BBAND[rowNumber].high);
                }
                else {
                    line.push(null);
                    line.push(null);
                    line.push(null);
                }

                if (symbolData.data[day].MACD[rowNumber] !== null) {
                    line.push(symbolData.data[day].MACD[rowNumber].MACD);
                    line.push(symbolData.data[day].MACD[rowNumber].signal);
                }
                else {
                    line.push(null);
                    line.push(null);
                }

                line.push(symbolData.data[day].RSI[rowNumber]);
                lines.push(line);
            }

            var date = convertUTCToDatestring(symbolData.data[day].created_at);
            var time = convertUTCToTimestring(symbolData.data[day].created_at);
            var path = 'exported/' + date + '/' + symbolData.symbol + '-' + time + '.csv'
            

            yield new Promise(function(resolve, reject) {
                stringify(lines, { header: true, columns: columns }, function(err, csv) {
                    if (err) {
                        reject(err);
                    }
                    Logging.log('       Writing to path: ' + path);    
                    fse.outputFileSync(path, csv);
                    resolve();
                });
            });
        }
    }

    // Will write out to a file structure like this:
        // exported
            // day 1 date (ex. 2-23-2016)
                // AUY.csv
                // NM.csv
                // etc...
            // day 2 date (ex. 2-24-2016)
                // AUY.csv
                // NM.csv
                // etc...
            // day 3 date (ex. 2-25-2016)
                // AUY.csv
                // NM.csv
                // etc...

    Logging.log("   OUTPUT [OK]");
    Logging.log("Export tool finished");
});;

function convertUTCToDatestring(string) {
   var date = new Date(string);
   var dd = date.getDate();
   var mm = date.getMonth() + 1; //January is 0!
   var yyyy = date.getFullYear();

   if (dd < 10) {
        dd = '0' + dd
    }

    if (mm < 10) {
        mm = '0' + mm
    }

   return yyyy + '-' + mm + '-' + dd;
}

function convertUTCToTimestring(string) {
   var date = new Date(string);
   var hr = date.getHours();
   var m = date.getMinutes();
   var ss = date.getSeconds();

   if (hr < 10) {
        hr = '0' + hr
    }

    if (m < 10) {
        m = '0' + m
    }

    if (ss < 10) {
        ss = '0' + ss
    }

   return hr + ':' + m + ':' + ss;
}

/**
 * Coroutine wrapper
 */
function co(generator) {
    return Promise.coroutine(generator);
}