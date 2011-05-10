var dust = require('../deps/dustjs/lib/dust'),
    async = require('../deps/async'),
    modules = require('./modules'),
    path = require('path'),
    utils = require('./utils'),
    fs = require('fs');


// disable whitespace compression
dust.optimizers.format = function (ctx, node) {
    return node;
};


exports.load = function (dir, doc, callback) {
    var p = doc.settings.templates;
    if (Array.isArray(p)) {
        return callback(new Error(
            'Only a single templates directory may be specified'
        ));
    }
    exports.find(path.join(dir, p), dir, function (err, files) {
        if (err) {
            return callback(err);
        }
        exports.addFiles(dir, files, doc, function (err) {
            if (err) {
                return callback(err);
            }
            var f = __dirname + '/../commonjs/kanso/templates.js';
            fs.readFile(f, function (err, src) {
                if (err) {
                    return callback(err);
                }

                // append the code from commonjs/templates.js
                doc.kanso.templates = 'var dust_module = {exports: {}};\n' +
                    '(function (module, exports) {\n' +
                        doc.kanso.templates + '\n}(' +
                        'dust_module, dust_module.exports' +
                    '));\n' +
                    'var dust = dust_module.exports;\n' +
                    src;

                modules.wrap(doc, 'kanso/templates', doc.kanso.templates);
                callback();
            });
        });
    });
};

exports.addFiles = function (dir, files, doc, callback) {
    dir = utils.abspath(dir);
    fs.readFile(__dirname + '/../deps/dustjs/lib/dust.js', function (err, src) {
        if (err) {
            return callback(err);
        }
        if (!doc.kanso) {
            doc.kanso = {};
        }
        var src_str = src.toString();
        doc.kanso.templates = src_str;

        async.forEach(files, function (f, cb) {
            exports.addFile(dir, utils.abspath(f), doc, cb);
        }, callback);
    });
};

exports.addFile = function (dir, file, doc, callback) {
    fs.readFile(file, function (err, content) {
        if (err) {
            return callback(err);
        }
        var rel = utils.relpath(file, path.join(dir, doc.settings.templates));
        doc.kanso.templates += dust.compile(content.toString(), rel);
        callback();
    });
};

exports.find = function (p, projectdir, callback) {
    utils.find(p, exports.filenameFilter(projectdir), callback);
};

exports.filenameFilter = function (projectdir) {
    return function (f) {
        var relpath = utils.relpath(f, projectdir);
        // should not start with a '.'
        if (/^\./.test(relpath)) {
            return false;
        }
        // should not contain a file or folder starting with a '.'
        if (/\/\./.test(relpath)) {
            return false;
        }
        return true;
    };
};
