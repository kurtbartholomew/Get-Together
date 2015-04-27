var express = require('express')
var app = express();
var path = require('path');
var logger = require('morgan');
var compression = require('compression');

app.use(express.static('public'));

app.use(logger('combined'));

app.use(compression());

module.exports = app;