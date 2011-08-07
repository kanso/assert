/**
 * Functions related to the finding, loading and manipulation of Kanso packages
 *
 * @module
 */

var settings = require('./settings'),
    buildsteps = require('./buildsteps'),
    async = require('../deps/async'),
    logger = require('./logger'),
    utils = require('./utils'),
    path = require('path'),
    _ = require('../deps/underscore/underscore')._;


/**
 * Store a list of loaded packages so we don't re-load and get conflicting
 * properties when a dependency of multiple packages.
 * Contains package paths keyed by package name.
 */

exports._loaded_packages = {};


/**
 * Loads a package, passing it through all plugin preprocessors before returning
 * the resulting document.
 *
 * Each preprocessor is passed the path to the package directory, the settings
 * loaded from its kanso.json file and the document returned from the previous
 * preprocessor.
 *
 * @param {String} name - the name / path of the package to lookup
 * @param {Boolean} root - whether this is the root package
 * @param {Array} paths - an array of package lookup paths
 * @param {String} source - the current package that paths are relative to
 * @param {Object} options - options to override values in package cfg
 * @param {Function} callback
 */

exports.load = function (name, root, paths, source, options, callback) {
    // TODO: clear _loaded_packages cache if root? or pass around a cache obj?
    exports.resolve(name, paths, source, function (err, p) {
        if (err) {
            return callback(err);
        }
        settings.load(p, function (err, cfg) {
            if (err) {
                return callback(err);
            }

            // extend kanso.json values with options passed from command-line
            _.extend(cfg, options);

            if (cfg.name in exports._loaded_packages) {
                if (p !== exports._loaded_packages[cfg.name]) {
                    // module found at mutliple paths
                    return callback(new Error(
                        'Conflicting packages for ' + cfg.name + ': "' +
                        p + '" and "' + exports._loaded_packages[cfg.name] + '"'
                    ));
                }
                // return empty object instead of a cached package because
                // otherwise the attempted merge will result in conflicting
                // properties
                return callback(null, null, cfg, p, true);
            }
            logger.info('loading', name);
            exports.loadDependencies(p, cfg, paths, source, options,
                function (err, doc, pre, post) {
                    if (err) {
                        return callback(err);
                    }
                    if (cfg.preprocessors) {
                        for (var k in cfg.preprocessors) {
                            if (!pre[cfg.name]) {
                                pre[cfg.name] = {};
                            }
                            if (!pre[cfg.name][k]) {
                                pre[cfg.name][k] = require(
                                    utils.abspath(cfg.preprocessors[k], p)
                                );
                            }
                        }
                    }
                    if (cfg.postprocessors) {
                        for (var k in cfg.postprocessors) {
                            if (!post[cfg.name]) {
                                post[cfg.name] = {};
                            }
                            if (!post[cfg.name][k]) {
                                post[cfg.name][k] = require(
                                    utils.abspath(cfg.postprocessors[k], p)
                                );
                            }
                        }
                    }
                    exports.process(pre, post, root, p, cfg, doc,
                        function (err, doc, cfg, p, already_loaded) {
                            callback.apply(this, arguments);
                        }
                    );
                }
            );
        });
    });
};

exports.loadDependencies = function (p, cfg, paths, source, options, callback) {
    var deps = Object.keys(cfg.dependencies || {}),
        post = {},
        pre = {};

    async.reduce(deps, {}, function (doc, k, cb) {
        exports.resolve(k, paths, source, function (err, np) {
            if (np === p) {
                return callback(new Error(
                    'Package should specify itself as a ' +
                    'dependency: ' + p
                ));
            }
            exports.load(k, false, paths, p, options,
                function (err, nd, nc, np, already_loaded) {
                    if (err) {
                        return cb(err);
                    }
                    if (nc.preprocessors) {
                        for (var k in nc.preprocessors) {
                            if (!pre[nc.name]) {
                                pre[nc.name] = {};
                            }
                            if (!pre[nc.name][k]) {
                                pre[nc.name][k] = require(
                                    utils.abspath(nc.preprocessors[k], np)
                                );
                            }
                        }
                    }
                    if (nc.postprocessors) {
                        for (var k in nc.postprocessors) {
                            if (!post[nc.name]) {
                                post[nc.name] = {};
                            }
                            if (!post[nc.name][k]) {
                                post[nc.name][k] = require(
                                    utils.abspath(nc.postprocessors[k], np)
                                );
                            }
                        }
                    }
                    if (already_loaded) {
                        return cb(null, doc);
                    }
                    cb(null, exports.merge(doc, nd));
                }
            );
        });
    },
    function (err, doc) {
        if (err) {
            return callback(err);
        }
        callback(null, doc, pre, post);
    });
};

exports.preprocess = function (pre, root, p, cfg, doc, callback) {
    var errs = [];
    var bm = new buildsteps.BuildManager([root, p, cfg], doc);
    bm.addAll(pre);
    bm.on('error', function (err, step) {
        errs.push({err: err, step: step});
    });
    bm.on('beforeStep', function (pkg, name) {
        if (root) {
            logger.info('preprocessor', pkg + '/' + name);
        }
    });
    bm.on('step', function (pkg, name) {
        logger.debug('completed preprocessor', pkg + '/' + name);
    });
    bm.on('end', function (doc, complete, incomplete) {
        if (errs.length) {
            errs.forEach(function (e) {
                logger.error(
                    'Error when running preprocessor: "' +
                    e.step.toString() + '"'
                );
                logger.error(e.err);
            });
            callback(errs[0].err);
        }
        if (incomplete.length) {
            incomplete.forEach(function (s) {
                logger.warning('Preprocessor failed to run', s.toString());
            });
        }
        callback(null, doc);
    });
    bm.run();
};

exports.postprocess = function (post, root, p, cfg, doc, callback) {
    var errs = [];
    var bm = new buildsteps.BuildManager([p, cfg], doc);
    bm.addAll(post);
    bm.on('error', function (err, step) {
        errs.push({err: err, step: step});
    });
    bm.on('beforeStep', function (pkg, name) {
        if (root) {
            logger.info('postprocessor', pkg + '/' + name);
        }
    });
    bm.on('step', function (pkg, name) {
        logger.debug('completed postprocessor', pkg + '/' + name);
    });
    bm.on('end', function (doc, complete, incomplete) {
        if (errs.length) {
            errs.forEach(function (e) {
                logger.error(
                    'Error when running postprocessor: "' +
                    e.step.toString() + '"'
                );
                logger.error(e.err);
            });
            callback(errs[0].err);
        }
        if (incomplete.length) {
            incomplete.forEach(function (s) {
                logger.warning('Postprocessor failed to run', s.toString());
            });
        }
        callback(null, doc);
    });
    bm.run();
};

exports.process = function (pre, post, root, p, cfg, doc, callback) {
    exports.preprocess(pre, root, p, cfg, doc, function (err, doc) {
        if (err) {
            return callback(err);
        }
        exports._loaded_packages[cfg.name] = p;
        if (root) {
            // run post-processors on merged document
            exports.postprocess(post, root, p, cfg, doc, function (err, doc) {
                callback(err, utils.stringifyFunctions(doc), cfg, p, false);
            });
        }
        else {
            callback(err, utils.stringifyFunctions(doc), cfg, p, false);
        }
    });
};


exports.merge = function (a, b, /*optional*/path) {
    a = a || {};
    b = b || {};
    path = path || [];

    for (var k in b) {
        /*
        if (k === '_wrapped_modules' && path.length === 0) {
            if (!a._wrapped_modules) {
                a._wrapped_modules = '';
            }
            a._wrapped_modules += b._wrapped_modules || '';
        }
        else */
        if (typeof b[k] === 'object') {
            a[k] = exports.merge(a[k], b[k], path.concat([k]));
        }
        else {
            if (a[k] && a[k] !== b[k]) {
                throw new Error(
                    'Conflicting property: ' + path.concat([k]).join('.')
                );
            }
            a[k] = b[k];
        }
    }
    return a;
};


/**
 * Looks up the path to a specified package, returning an error if not found.
 *
 * @param {String} name - the name / path of the package to lookup
 * @param {Array} paths - an array of package lookup paths
 * @param {String} source - the current package that paths are relative to
 * @param {Function} callback
 */

exports.resolve = function (name, paths, source, callback) {
    souce = source || process.cwd();
    var candidates = [];
    if (name[0] === '/') {
        // absolute path to a specific package directory
        candidates.push(name);
    }
    else if (name[0] === '.') {
        // relative path to a specific package directory
        candidates.push(path.normalize(path.join(source, name)));
    }
    else {
        candidates = candidates.concat(paths.map(function (dir) {
            return path.join(dir, name);
        }));
    }
    async.forEachSeries(candidates, function (c, cb) {
        path.exists(path.join(c, 'kanso.json'), function (exists) {
            if (exists) {
                return callback(null, c);
            }
            cb();
        });
    },
    function () {
        return callback(new Error("Cannot find package '" + name + "'"));
    });
};
