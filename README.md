## Assert Module

This is a browser port of the Node.js assert module. This module is also used
internally by Nodeunit.


### Usage

```javascript
var assert = require('assert');

assert.ok(true, 'This will pass');
assert.equal('foo', 'bar', 'This will throw an AssertionError');
```


### API


#### AssertionError

Constructor for assertion error objects.

```javascript
new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected
})
```


#### assert.ok(value, [message])

Pure assertion, tests whether a value is truthy as determined by !!value.
This statement is equivalent to `assert.equal(true, value, message)`.  To test
strictly for the value true, use `assert.strictEqual(true, value, message)`.


#### assert.equal(actual, expected, [message])

The equality assertion tests shallow, coercive equality with `==`.


#### assert.notEqual(actual, expected, [message])

The non-equality assertion tests for whether two objects are not equal with `!=`.


#### assert.deepEqual(actual, expected, [message])

The equivalence assertion tests a deep equality relation.


#### assert.notDeepEqual(actual, expected, [message])

The non-equivalence assertion tests for any deep inequality.


#### assert.strictEqual(actual, expected, [message])

The strict equality assertion tests strict equality, as determined by `===`.


#### assert.notStrictEqual(actual, expected, [message])

The strict non-equality assertion tests for strict inequality, as determined
by `!==`.


#### assert.throws(block, [error], [message])

Calls function `block` and expects it to throw an error (optionally matching the
`error` argument).


#### assert.doesNotThrow(block, [error], [message])

Opposite of `assert.throws`, fails if the function throws an exception.


#### assert.ifError(value)

Tests if value is not a false value, throws if it is a true value. Useful when testing the first argument, `error` in callbacks following the Node.js style.
