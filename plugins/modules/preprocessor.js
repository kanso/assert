var modules = require('../../lib/modules'),
    async = require('../../deps/async');


/**
 * Loads module directories specified in kanso.json and adds the modules
 * to the document.
 */

module.exports = function (root, path, settings, doc, callback) {
    var paths = settings.modules || [];
    if (!Array.isArray(paths)) {
        paths = [paths];
    }
    async.forEach(paths, function (p, cb) {
        modules.addPath(path, p, doc, cb);
    },
    function (err) {
        // TODO: move manual loading of kanso commonjs modules to package
        // loading code
        var kanso_dir = __dirname + '/../../commonjs';
        modules.addPath(kanso_dir, 'kanso', doc, function (err) {
            callback(err, doc);
        });
    });
};
