/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var mysql = require('mysql');

var lru = require('ttl-lru-cache')({
  maxLength: 5000
});
var withConfig = require('./config').withConfig;

var SELECT_SQL = "SELECT id, version, manifest_url, manifest_hash, " +
  "library_version FROM apk_metadata " +
  "WHERE id = ?";

var INSERT_SQL = "INSERT INTO apk_metadata (id, version, manifest_url, " +
  "manifest_hash, library_version) VALUES " +
  "(?, ?, ?, ?, ?)";

var UPDATE_SQL = "UPDATE apk_metadata SET " +
  "version = ?, manifest_hash = ?, library_version = ? " +
  "WHERE id = ? ";

withConfig(function(config) {
  var log = require('./logging')(config);
  var HASH_TTL = config.manifestCacheTTL * 1000;

  /*
   * No DB Pooling - KISS. We'll switch to pooling if DB becomes a perf issue.
   */
  exports.saveMetadata = function(metadata, config, cb) {
    log.info('DB clearing lru for ' + metadata.id);
    lru.clear(metadata.id);
    var params = [
      metadata.id,
      metadata.version,
      metadata.manifest_url,
      metadata.manifest_hash,
      metadata.library_version
    ];
    var conn = mysql.createConnection(config.mysql);
    try {
      conn.connect();
      conn.query(INSERT_SQL, params, function(err /*, rows, fields*/ ) {
        conn.end();
        return cb(err);
      });
    } catch (e) {
      cb(e);
    }
  };

  exports.updateMetadata = function(metadata, config, cb) {
    log.info('DB clearing lru for ' + metadata.id);
    lru.clear(metadata.id);
    var params = [
      metadata.version,
      metadata.manifest_hash,
      metadata.library_version,
      metadata.id
    ];
    var conn = mysql.createConnection(config.mysql);
    try {
      conn.connect();
      conn.query(UPDATE_SQL, params, function(err /*, rows, fields*/ ) {
        conn.end();
        return cb(err);
      });
    } catch (e) {
      cb(e);
    }
  };

  exports.getMetadata = function(id, config, cb) {
    var metadata = lru.get(id);
    if (undefined !== metadata) {
      log.info('DB cache hit for ' + id);
      return cb(null, metadata);
    }
    var conn = mysql.createConnection(config.mysql);
    try {
      conn.connect();
      conn.query(SELECT_SQL, [id], function(err, rows /*, fields*/ ) {
        conn.end();
        var results = null;
        if (err) {
          return cb(err);
        }
        if (rows && rows.length > 0) {
          results = rows[0];
        }
        log.info('DB cache miss, setting into cache ' + id);
        lru.set(id, results, HASH_TTL);
        return cb(null, results);
      });
    } catch (e) {
      cb(e);
    }
  };
});
