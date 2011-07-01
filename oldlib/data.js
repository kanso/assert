var fs = require('fs'),
    async = require('../deps/async'),
    utils = require('./utils');


exports.eachDoc = function (p, iterator, callback) {
    fs.stat(p, function (err, stats) {
        if (err) {
            return callback(err);
        }
        if (stats.isDirectory()) {
            exports.find(p, function (err, files) {
                if (err) {
                    return callback(err);
                }
                async.forEach(files, function (f, cb) {
                    if (err) {
                        return callback(err);
                    }
                    utils.readJSON(f, function (err, doc) {
                        if (err) {
                            return callback(err);
                        }
                        iterator(f, doc, cb);
                    });
                }, callback);
            });
        }
        else {
            utils.readJSON(p, function (err, doc) {
                if (err) {
                    return callback(err);
                }
                iterator(p, doc, callback);
            });
        }
    });
};

exports.find = function (p, callback) {
    utils.find(p, function (f) {
        var relpath = utils.relpath(f, p);
        // should not start with a '.'
        if (/^\./.test(relpath)) {
            return false;
        }
        // should not contain a file or folder starting with a '.'
        if (/\/\./.test(relpath)) {
            return false;
        }
        // should have a .json extension
        if (!/\.json$/.test(relpath)) {
            return false;
        }
        return true;
    }, callback);
};
