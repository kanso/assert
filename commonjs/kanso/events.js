/**
 * The events module handles events emitted by Kanso as well as custom
 * events defined by a Kanso app. These events can be used client-side
 * or server-side. Although you are limited to synchronous operation on
 * the server, so events are less likely to be useful there.
 *
 * @module
 */

/**
 * Module dependencies
 */

var _ = require('./underscore')._;

/**
 * Stores the bound listeners
 */

var listeners = {};


/**
 * Adds a listener function for the given event name.
 *
 * @name on(name, listener)
 * @param {String} name
 * @param {Function} listener
 * @api public
 */

exports.on = function (name, listener) {
    if (!listeners[name]) {
        listeners[name] = [];
    }
    listeners[name].push(listener);
};

/**
 * Binds an event listener to the given event name, but unbinds it
 * after its first invocation.
 *
 * @name once(name, listener)
 * @param {String} name
 * @param {Function} listener
 * @api public
 */

exports.once = function (name, listener) {
    var fn = function () {
        var result = listener.apply(this, arguments);
        exports.removeListener(name, listener);
        return result;
    };
    fn.listener = listener;
    exports.on(name, fn);
};

/**
 * Triggers any event listeners bound to the given event name. Listeners
 * are called in the order they were bound. If a listener returns false
 * subsequent event listeners in the chain are not called.
 *
 * The first argument is the event name to emit any additional arguments
 * are used as arguments to the bound event listeners.
 *
 * @name emit(name, [...])
 * @param {String} name
 * @param ...
 * @api public
 */

exports.emit = function (name) {
    //console.log('Event: ' + name);
    console.log(arguments);
    var args = Array.prototype.slice.call(arguments, 1);
    var fns = exports.listeners(name);
    for (var i = 0, len = fns.length; i < len; i++) {
        var result = fns[i].apply(null, args);
        if (result === false) {
            return;
        }
    }
};

/**
 * Returns an array of the bound event listeners for the given event name.
 * If no events are bound, an empty array is returned.
 *
 * @name listeners(name)
 * @param {String} name
 * @return {Array}
 * @api public
 */

exports.listeners = function (name) {
    var fns = listeners[name] || [];
    return listeners[name] || [];
};

/**
 * Removes all bound event listeners for a given event name.
 *
 * @name removeAllListeners(name)
 * @param {String} name
 * @api public
 */

exports.removeAllListeners = function (name) {
    delete listeners[name];
};

/**
 * Removes a specific event listener for a given event name.
 *
 * @name removeListener(name, listener)
 * @param {String} name
 * @param {Function} listener
 * @api public
 */

exports.removeListener = function (name, listener) {
    listeners[name] = _.filter(exports.listeners(name), function (l) {
        return l !== listener && (!l.listener || l.listener !== listener);
    });
};
