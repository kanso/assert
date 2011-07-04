var attachments = require('../../lib/attachments'),
    async = require('../../deps/async');


/**
 * Loads attachment directories specified in kanso.json and adds the attachments
 * to the document.
 */

module.exports = function (path, settings, doc, callback) {
    var paths = settings.attachments || [];
    if (!Array.isArray(paths)) {
        paths = [paths];
    }
    async.forEach(paths, function (p, cb) {
        attachments.addPath(path, p, doc, cb);
    },
    function (err) {
        callback(err, doc);
    });
};
