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

var GithubWebHook = require('express-github-webhook');
var webhookHandler = GithubWebHook({ path: '/webhook/issue_comment', secret: process.env.WEBHOOK_SECRET });
var bodyParser = require('body-parser');

var express = require('express');
var app = express();

var PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(webhookHandler);

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

app.get('/topissues', function(req, res) {
  var fromTime = req.query.from;
  var toTime = req.query.to;
  var queryString = "SELECT dest, count(dest) as dest_count from dependencies where create_at BETWEEN ('" + fromTime + "') AND ('" + toTime + "') group by dest having count(dest) > 5 order by count(dest) desc";
  var query = [];

  db.any(queryString)
  .then(function (rows) {
    rows.forEach(function(row) {
      console.log(row);
      query.push({source: row.dest, count: row.dest_count});
    });
  })
  .catch(function (error) {
    console.log("ERROR: " + error);
  })
  .finally(() => {
    res.json(query);
  });
});

webhookHandler.on('*', function (event, repo, data) {
  // We only handle issue_comment created
  if (data.action == 'created') {
    var issue = data.issue;
    var comment = data.comment;

    // Parse comment.body to see if there is bugzilla bug
    var bugzilla_regexp = /(https:\/\/bugzilla\.mozilla\.org\/show_bug\.cgi\?id=)(\d+)/g;
    if (comment.body.match(bugzilla_regexp)) {
      comment.body.match(bugzilla_regexp).forEach(function(res) {
        var issue_created_at = issue.created_at.substring(0, 10);
        var insert_command = 'INSERT INTO dependencies(create_at, source, dest) VALUES($1, $2, $3) RETURNING id';
        db.one(insert_command, [issue_created_at, "Issue " + issue.number, "Bug " + res.split('https://bugzilla.mozilla.org/show_bug.cgi?id=')[1]])
        .then(data => {
          console.log("New dependency ID=" + data.id);
        })
        .catch(error => {
          console.log("Error: " + error);
        });
      });
    }
    // Parse comment.body, to see if there is webcompat issue
    var issue_regexp = /( \#)(\d+)/g;
    if (comment.body.match(issue_regexp)) {
      comment.body.match(issue_regexp).forEach(function(res) {
        var issue_created_at = issue.created_at.substring(0, 10);
        var insert_command = 'INSERT INTO dependencies(create_at, source, dest) VALUES($1, $2, $3) RETURNING id';
        db.one(insert_command, [issue_created_at, "Issue " + issue.number, "Issue " + res.split(' #')[1]])
        .then(data => {
          console.log("New dependency ID=" + data.id);
        })
        .catch(error => {
          console.log("Error: " + error);
        });
      });
    }
  }
});

webhookHandler.on('error', function (err, req, res) {
  console.log("Handle webhook error: " + err);
});

app.listen(PORT);
console.log("Running at port: " + PORT);
