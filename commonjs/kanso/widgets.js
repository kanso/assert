/*global $: false, kanso: true*/

/**
 * Widgets define the way a Field object is displayed when rendered as part of a
 * Form. Changing a Field's widget will be reflected in the admin app.
 *
 * @module
 */

var _ = require('kanso/underscore')._;

var modules = [
    './widgets_core', './widgets_embed',
        './widgets_selector', './widgets_jquery'
];

_.reduce(modules, function (a, m) {
    return _.extend(a, require(m));
}, exports);

