var express = require('express')
var app = express();
// can use morgan to create error log file
var logger = require('morgan');
var compression = require('compression');

app.use(express.static('public'));

app.use(logger('combined'));

app.use(compression());

module.exports = app;