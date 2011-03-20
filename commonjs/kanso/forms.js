var types = require('./types'),
    utils = require('./utils');


var Form = exports.Form = function Form(obj, doc) {
    // TODO: when a module cache is implemented in couchdb, we can change this
    // to an instanceof check. until then instanceof checks are to be considered
    // fragile
    if (utils.constructorName(obj) === 'Type') {
        this.fields = obj.fields;
    }
    else {
        this.fields = obj;
    }
    if (doc) {
        this.values = doc;
    }
};

Form.prototype.validate = function (req) {
    this.values = exports.parseRequest(this.fields, req);
    var validation_errors = types.validateFields(
        this.fields, this.values, this.values, [], false
    );
    var required_errors = types.checkRequired(this.fields, this.values, []);
    this.errors = required_errors.concat(validation_errors);
    return this;
};

Form.prototype.toHTML = function (req, iterator) {
    iterator = iterator || exports.render.div;
    return exports.renderFields(
        req, iterator, this.fields, this.values, this.errors, []
    );
};

Form.prototype.isValid = function () {
    return (!this.errors || this.errors.length === 0);
};

exports.parseRequest = function (fields, req) {
    var values = {};
    for (var k in req.form) {
        var f = utils.getPropertyPath(fields, k.split('.'));
        // TODO: when a module cache is implemented in couchdb, we can
        // change this to an instanceof check. until then instanceof
        // checks are to be considered fragile
        if (utils.constructorName(f) === 'Field') {
            var val = req.form[k];
            // has a value or omit_empty option is false
            if ((val !== undefined && val !== '') || !f.omit_empty) {
                val = f.parse(val);
                utils.setPropertyPath(values, k.split('.'), val);
            }
        }
        else {
            utils.setPropertyPath(values, k.split('.'), req.form[k]);
        }
    }
    return values;
};

exports.getErrors = function (errors, path) {
    if (!errors || !errors.length) {
        return [];
    }
    var errs = [];
    var field_name = path.join('.');
    for (var i = 0; i < errors.length; i++) {
        if (errors[i].field.join('.') === field_name) {
            errs.push(errors[i]);
        }
    }
    return errs;
};

exports.renderFields = function (req, iterator, fields, values, errors, path) {
    var html = '';
    for (var k in fields) {
        if (fields.hasOwnProperty(k)) {
            var field = fields[k];
            var field_path = path.concat([k]);
            var errs = exports.getErrors(errors, field_path);
            // TODO: when a module cache is implemented in couchdb, we can
            // change this to an instanceof check. until then instanceof
            // checks are to be considered fragile
            if (utils.constructorName(field) === 'Field') {
                var name = field_path.join('.');
                var val;
                if (values) {
                    val = utils.getPropertyPath(values, field_path);
                }
                else if (field.default_value) {
                    if (utils.isFunction(field.default_value)) {
                        val = field.default_value(req);
                    }
                    else {
                        val = field.default_value;
                    }
                }
                else {
                    val = undefined;
                }
                html += iterator(name, field, val, errs);
            }
            else {
                var subvalues = utils.getPropertyPath(values, field_path);
                // sub-object, recurse through and check for more fields
                html += exports.renderFields(
                    req, iterator, field, subvalues, errors, field_path
                );
            }
        }
    }
    return html;
};


/**
 * iterator functions for use with renderFields
 */

var wrapWith = function (tag) {
    return function (name, field, value, errors) {
        var html = '<' + tag +
            ' class="' + field.classes(errors).join(' ') + '">';

        if (field.widget.type === 'hidden') {
            return field.widget.toHTML(name, value);
        }
        else if (field.widget.type === 'multipleCheckbox' ||
           field.widget.type === 'multipleRadio') {
            html += '<fieldset>' +
                '<legend>' + field.labelText(name) + '</legend>' +
                field.errorHTML() +
                field.widget.toHTML(name, value) +
            '</fieldset>';
        }
        else {
            html += field.errorHTML(errors) +
                field.labelHTML(name) +
                field.widget.toHTML(name, value);
        }
        return html + '</' + tag + '>';
    };
};

exports.render = {
    div: wrapWith('div'),
    p: wrapWith('p'),
    li: wrapWith('li'),
    table: function (name, field, value, errors) {
        // TODO: handle multipleCheckbox and multipleRadio fields
        if (field.widget.type === 'hidden') {
            return field.widget.toHTML(name, value);
        }
        return '<tr class="' + field.classes(errors).join(' ') + '">' +
            '<th>' + field.labelHTML(name) + '</th>' +
            '<td>' +
                field.widget.toHTML(name, value) +
            '</td>' +
            '<td class="errors">' +
                field.errorHTML(errors) +
            '</td>' +
        '</tr>';
    }
};
