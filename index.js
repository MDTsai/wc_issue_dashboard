/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const promise = require('bluebird');
const initOptions = {
    promiseLib: promise // overriding the default (ES6 Promise);
};

var pgp = require("pg-promise")(initOptions);
const databaseConfig = process.env.DATABASE_URL ||
{
  "host": process.env.DB_HOST,
  "port": process.env.DB_PORT,
  "database": process.env.DB_NAME,
  "user": process.env.DB_USER,
  "password": process.env.DB_PASS
};
var db = pgp(databaseConfig);

var express = require('express');
var app = express();

var PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/dependency', function(req, res) {
  var fromTime = req.query.from;
  var toTime = req.query.to;
  var queryString = "SELECT * from dependencies WHERE create_at BETWEEN ('" + fromTime + "') AND ('" + toTime + "')";
  var query = [];

  db.any(queryString)
  .then(function (rows) {
    rows.forEach(function(row) {
      query.push({from: row.source, to: row.dest});
    });
  })
  .catch(function (error) {
    console.log("ERROR: " + error);
  })
  .finally(() => {
    res.json(query);
  });
});

app.listen(PORT);
console.log("Running at port: " + PORT);
