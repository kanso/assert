/**
 * Functions related to the loading and manipulation of CommonJS Modules in
 * Kanso apps.
 *
 * @module
 */

var utils = require('./utils'),
    async = require('../deps/async'),
    path = require('path'),
    fs = require('fs'),
    evals = process.binding('evals'),
    Script = evals.Script || evals.NodeScript;


// As modules are added, their original file paths are added to this object
// eg: {'lib': {'mymodule': '/home/user/project/lib/mymodule.js'}, ...}
exports.originalPaths = {};


/**
 * Add the module source to the document in the correct location for requiring
 * server-side, then add to the _wrapped_modules for use client-side.
 * Returns the updated document.
 *
 * @param {Object} doc
 * @param {String} path
 * @param {String} src
 * @returns {Object}
 */

exports.add = function (doc, path, src) {
    utils.setPropertyPath(doc, path, src);
    exports.wrap(doc, path, src);
    return doc;
};


/**
 * Wraps module source code with useful comments and module cache boilerplate
 * code. The result is added to the _wrapped_modules property of the document
 * to be moved into an attachment later.
 *
 * @param {Object} doc
 * @param {String} path
 * @param {String} src
 * @returns {Object}
 */

exports.wrap = function (doc, path, src) {
    var wrapped = '/********** ' + path + ' **********/\n\n' +
        'kanso.moduleCache["' + path.replace('"', '\\"') + '"] = ' +
        '{load: (function (module, exports, require) {\n\n' + src + '\n\n})};' +
        '\n\n';

    if (!doc.hasOwnProperty('_wrapped_modules')) {
        doc._wrapped_modules = '';
    }
    doc._wrapped_modules += wrapped;
    return doc;
};


/**
 * Searchs a path for commonjs modules, adding them to the document.
 *
 * @param {String} pkgdir - path to the source package
 * @param {String} p      - path to a module file or directory of modules
 * @param {Object} doc    - the document to extend
 * @param {Function} callback
 */

exports.addPath = function (pkgdir, p, doc, callback) {
    p = utils.abspath(p, pkgdir);
    exports.find(p, function (err, files) {
        if (err) {
            return callback(err);
        }
        async.forEach(files, function (f, cb) {
            exports.addFile(pkgdir, f, doc, cb);
        }, callback);
    });
};


/**
 * Loads a module file and adds its contents to the document
 *
 * @param {String} pkgdir
 * @param {String} p
 * @param {Object} doc
 * @param {Function} callback
 */

exports.addFile = function (pkgdir, p, doc, callback) {
    fs.readFile(p, function (err, content) {
        if (err) {
            return callback(err);
        }
        var rel = utils.relpath(p, pkgdir);
        var module_path = rel.replace(/\.js$/, '');
        var src = content.toString();
        exports.add(doc, module_path, src);
        utils.setPropertyPath(exports.originalPaths, rel, p);
        callback()
    });
};


/**
 * Find all modules below or at a given path, recursing through subdirectories
 *
 * @param {String} p - the path to search
 * @param {Function} callback
 */

exports.find = function (p, callback) {
    utils.find(p, exports.filenameFilter(p), callback);
};


/**
 * Creates a filter used when searching for module files. This function tests
 * for a .js extension and omits hidden dot-preceeded filenames.
 *
 * @param {String} p - the path to the directory being searched
 * @returns {Function}
 */

exports.filenameFilter = function (p) {
    return function (f) {
        var relpath = utils.relpath(f, p);
        // should not start with a '.'
        if (/^\./.test(relpath)) {
            return false;
        }
        // should not contain a file or folder starting with a '.'
        if (/\/\./.test(relpath)) {
            return false;
        }
        // should have a .js extension
        if (!/\.js$/.test(f)) {
            return false;
        }
        return true;
    };
};


/**
 * Loads a commonjs module from the loaded design document, returning
 * the exported properties. The current_dir and target parameters are not the
 * path of the module on the filesystem, but rather the path of the module
 * within couchdb, root ('/') being the design doc itself.
 *
 * @param {Object} module_cache
 * @param {Object} doc
 * @param {String} current_dir
 * @param {String} target
 * @param {Object} context - optional, extends sandbox object
 */

exports.require = function (module_cache, doc, current_dir, target, context) {
    if (target.charAt(0) !== '.') {
        current_dir = '/';
    }
    var p = path.normalize(path.join(current_dir, target));
    if (module_cache[p]) {
        return module_cache[p];
    }

    var nodes = p.split('/').slice(1);
    var content = nodes.reduce(function (a, x) {
        if (a[x] === undefined) {
            throw new Error('Could not require module: ' + target);
        }
        a = a[x];
        return a;
    }, doc);

    var sandbox = {
        module: {exports: {}},
        require: async.apply(
            exports.require, module_cache, doc, path.dirname(p)
        ),
        log: function () {
            console.log.apply(console, arguments);
        }
    };
    sandbox.exports = sandbox.module.exports;

    // copy context into sandbox
    if (context) {
        Object.keys(context).forEach(function (k) {
            sandbox[k] = context[k];
        });
    }

    // Create a placeholder for this module's exports so circular requires
    // are possible. TODO: node.js uses a loaded = false attribute on the
    // cached module object to mark this as a placeholder.
    module_cache[p] = {};

    var filename;
    try {
        filename = utils.getPropertyPath(
            exports.originalPaths, p.substr(1), true
        );
        var s = new Script(content, filename).runInNewContext(sandbox);
    }
    catch (e) {
        if (e instanceof SyntaxError && filename) {
            // gives a better syntax error than runInNewContext
            // with filename and line number
            require(filename);
        }
        else {
            throw e;
        }
    }
    module_cache[p] = sandbox.module.exports;
    return module_cache[p];
};
