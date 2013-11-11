var _ = require("underscore"),
    fs = require("fs.extra"),
    request = require("request"),
    path = require("path"),
    url = require("url");


/**
 * Util functions
 */
function ensureDirectoryExistsFor(filename) {
  var dirname = path.dirname(filename);
  if (fs.existsSync(dirname)) {
    return;
  }

  fs.mkdirRecursiveSync(dirname);
}


/**
 * Objects
 */

function FileLoader (prefix) {
  if (prefix) {
    this.prefix = path.resolve(process.cwd(), prefix);
  } else {
    this.prefix = process.cwd();
  }

}
_.extend(FileLoader.prototype, {
  copy: function (suffix, destFile, cb) {
    var srcFile = path.join(this.prefix, suffix);
    ensureDirectoryExistsFor(destFile);
    fs.copy(srcFile, destFile, cb);
  },

  load: function (suffix, cb) {
    var srcFile = path.resolve(this.prefix, suffix);

    if (cb) {
      fs.readFile(srcFile, cb);
    } else {
      return fs.readFileSync(srcFile, "utf8");
    }
  },

  write: function (filename, content) {
    ensureDirectoryExistsFor(filename);
    fs.writeFileSync(filename, content);
  },

  ensureDirectoryExistsFor: ensureDirectoryExistsFor
});

function HttpFileLoader (prefix) {
  this.prefix = prefix;
}
HttpFileLoader.prototype = _.extend(new FileLoader(), {

  load: function (suffix, cb) {
    var srcFile = this.prefix + suffix;
    if (cb) {
      request(srcFile, function (error, response, body) {
        if (!error && response.statusCode === 200) {
          cb(error, body);
        } else {
          cb(error);
        }
      });
    } else {
      throw "NOT IMPLEMENTED";
    }

  },

  copy: function (suffix, destFile, cb) {
    var srcFile = url.resolve(this.prefix, suffix);
    ensureDirectoryExistsFor(destFile);
    request(srcFile).pipe(fs.createWriteStream(destFile));
    cb();
  }

});


module.exports = {
  create: function (prefix) {
    if (/^\w+:\/\//.test(prefix)) {
      return new HttpFileLoader(prefix);
    } else {
      return new FileLoader(prefix);
    }
  },

  ensureDirectoryExistsFor: ensureDirectoryExistsFor
};