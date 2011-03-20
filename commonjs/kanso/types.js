/**
 * Module dependencies
 */

var fields = require('./fields'),
    widgets = require('./widgets'),
    utils = require('./utils'),
    Field = fields.Field;


var Type = exports.Type = function Type(name, options) {
    if (typeof name !== 'string') {
        throw new Error('First argument must be the type name');
    }
    this.name = name;
    this.permissions = options.permissions || {};
    this.allow_extra_fields = options.allow_extra_fields || false;

    this.fields = {
        _id: fields.string({
            required: false,
            omit_empty: true,
            widget: widgets.hidden()
        }),
        _rev: fields.string({
            required: false,
            omit_empty: true,
            widget: widgets.hidden(),
            permissions: [
                function (newDoc, oldDoc, newVal, oldVal, userCtx) {
                    if (oldDoc) {
                        if (newVal !== oldVal) {
                            throw new Error(
                                'Cannot change type field after document has ' +
                                'been created'
                            );
                        }
                    }
                }
            ]
        }),
        type: fields.string({
            default_value: name,
            widget: widgets.hidden(),
            validators: [function (doc, value) {
                if (value !== name) {
                    throw new Error('Unexpected value for type');
                }
            }]
        })
    };
    if (options.fields) {
        for (var k in options.fields) {
            if (options.fields.hasOwnProperty(k)) {
                this.fields[k] = options.fields[k];
            }
        }
    }
};

Type.prototype.validate = function (doc) {
    var validation_errors = exports.validateFields(
        this.fields, doc, doc, [], this.allow_extra_fields
    );
    var required_errors = exports.checkRequired(this.fields, doc, []);
    return required_errors.concat(validation_errors);
};

Type.prototype.authorize = function (newDoc, oldDoc, userCtx) {
    return exports.authorizeFields(
        this.fields, newDoc, oldDoc, newDoc, oldDoc, userCtx, []
    );
};


/**
 * Iterates over fields, checking for an associated value if the field is
 * required.
 *
 * @param {Object} fields
 * @param {Object} values
 * @param {Array} path
 * @return {Array}
 */

exports.checkRequired = function (fields, values, path) {
    var errors = [];

    for (var k in fields) {
        if (fields.hasOwnProperty(k)) {
            var f = fields[k];
            var f_path = path.concat([k]);
            // TODO: when a module cache is implemented in couchdb, we can
            // change this to an instanceof check. until then instanceof
            // checks are to be considered fragile
            if (utils.constructorName(f) === 'Field') {
                if (f.required) {
                    if (!values.hasOwnProperty(k)) {
                        var err = new Error('Required field');
                        err.field = f_path;
                        errors.push(err);
                    }
                }
            }
            else {
                // recurse through sub-objects in the type's schema to find
                // more fields
                var subvals2 = values.hasOwnProperty(k) ? values[k]: {};
                errors = errors.concat(exports.checkRequired(
                    f, subvals2, f_path
                ));
            }
        }
    }

    return errors;
};


/**
 * Iterates over values and checks against field validators, recursing through
 * sub-objects. Returns an array of validation errors, or an empty array if
 * valid.
 *
 * @param {Object} fields
 * @param {Object} values
 * @param {Object} doc
 * @param {Array} path
 * @param {Boolean} allow_extra
 * @return {Array}
 */

exports.validateFields = function (fields, values, doc, path, allow_extra) {
    var errors = [];

    for (var k in values) {
        if (values.hasOwnProperty(k)) {
            var f = fields[k];
            if (f === undefined) {
                // extra field detected
                if (!allow_extra) {
                    // check for couchdb reserved fields, and let couchdb
                    // handle the validity of those
                    if (!(path.length === 0 && k.substr(1) !== '_')) {
                        var err = new Error(
                            'Field "' + path.concat([k]).join('.') +
                            '" not defined'
                        );
                        err.field = path.concat([k]);
                        errors.push(err);
                    }
                }
            }
            // TODO: when a module cache is implemented in couchdb, we can
            // change this to an instanceof check. until then instanceof
            // checks are to be considered fragile
            else if (utils.constructorName(f) === 'Field') {
                // its a field, validate it
                try {
                    f.validate(doc, values[k], values[k]);
                }
                catch (e) {
                    e.field = path.concat([k]);
                    errors.push(e);
                }
            }
            else {
                // recurse through sub-objects in the type's schema to find
                // more fields
                errors = errors.concat(exports.validateFields(
                    fields[k], values[k], doc, path.concat([k]), allow_extra
                ));
            }
        }
    }
    return errors;
};

/**
 * Iterates over values and checks against field permissions, recursing through
 * sub-objects. Returns an array of permission errors, or an empty array if
 * valid.
 *
 * @param {Object} fields
 * @param {Object} newValues
 * @param {Object} oldValues
 * @param {Object} newDoc
 * @param {Object} oldDoc
 * @param {Object} userCtx
 * @param {Array} path
 * @return {Array}
 */

exports.authorizeFields = function (fields, newValues, oldValues, newDoc,
                                    oldDoc, userCtx, path) {
    var errors = [];

    for (var k in fields) {
        if (fields.hasOwnProperty(k)) {
            var f = fields[k];
            // TODO: when a module cache is implemented in couchdb, we can
            // change this to an instanceof check. until then instanceof
            // checks are to be considered fragile
            if (utils.constructorName(f) === 'Field') {
                // its a field, validate it
                try {
                    f.authorize(
                        newDoc,
                        oldDoc,
                        newValues[k],
                        oldValues[k],
                        userCtx
                    );
                }
                catch (e) {
                    e.field = path.concat([k]);
                    errors.push(e);
                }
            }
            else {
                // recurse through sub-objects in the type's schema to find
                // more fields
                errors = errors.concat(exports.authorizeFields(
                    fields[k],
                    newValues[k],
                    oldValues[k],
                    newDoc,
                    oldDoc,
                    userCtx,
                    path.concat([k])
                ));
            }
        }
    }
    return errors;
};


// TODO: when circular requires are fixed in couchdb, remove types argument?
exports.validate_doc_update = function (types, newDoc, oldDoc, userCtx) {
    var type = (oldDoc && oldDoc.type) || newDoc.type;
    if (type && types[type]) {
        var validation_errors = types[type].validate(newDoc);
        if (validation_errors.length) {
            var err = validation_errors[0];
            throw {forbidden: err.message || err.toString()};
        }
        var permissions_errors = types[type].authorize(newDoc, oldDoc, userCtx);
        if (permissions_errors.length) {
            var err = permissions_errors[0];
            throw {unauthorized: err.message || err.toString()};
        }
    }
};
