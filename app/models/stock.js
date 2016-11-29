/**
 * Copyright (c) 2016 Chandler Freeman
 * Created on 4/12/16.
 */
var mongoose = require('mongoose');

var dailyStockDataSchema = mongoose.Schema({
  quotes: { type: Array, default: [] },
  MACD: { type: Array, default: [] },
  BBAND: { type: Array, default: [] },
  RSI: { type: Array, default: [] },
  divorceLowerBound: { type: Array, default: [] },
  divorceBuffer: { type: Number, required: true }
}, { timestamps: {
  createdAt: 'created_at',
  updatedAt: 'updated_at'}
});

var stockSchema = mongoose.Schema({
  symbol: { type: String, unique: true, required: true },
  data: [ dailyStockDataSchema ]
}, { timestamps: {
  createdAt: 'created_at',
  updatedAt: 'updated_at'}
}, { collection : 'stocks' });

stockSchema.pre('save', function(next) {
  var stock = this;
  next();
});

module.exports = mongoose.model('Stock', stockSchema);
module.exports.DailyStockData = mongoose.model('DailyStockData', dailyStockDataSchema);
