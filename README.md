NodUnit
=======
A very simple unit testing script (not framework) for Node.js.

Introduction
------------
This is a simple unit testing script that will automatically detect, load,
execute test functions and report all declared test files. 

This unit testing script makes available the object `assert` globally.
Therefore, there is no need of requiring the `assert` module. Also, the
extended `assert.skip(message)` function is added for convenience, to
skip a test case from a suite. (Ex: `assert.skip('TODO : add more tests!');`)

Any file ending with `*Test.js` will be considered a test suite file. Each
test suite file should return an object containing the test functions :

* **setup()** *(optional)* : called before all other methods of the suite
* **teardown()** *(optional)* : called after all other methods of the suite
* **beforeTest()** *(optional)* : called before every test case
* **afterTest()** *(optional)* : called after every test case
* **testXXXXX()** : any method starting with `test*` will be considered a unit test case

Typically, the file `./test/fooTest.js` should test the file `./foo.js`

There should only be declarative statements outside test functions. Therefore,
the `setup` function should be responsible of executing `require` of the actual
tested module.

By default, each test case is run synchronously, but if the test case function
has at least one argument, the first argument will be the async callback to
terminate the test case. This callback function accepts one argument, the error
status, that should contain a null value for success, or a string or Error object
for failure.

**Note** : an asynchronous test case function can not be skipped. If an `assert.skip()`
is made and the generated error is caught and sent back to the callback function,
it will be treated as a failure and not a skipped test. If any assertion fails and
is not caught in a try catch block, it will terminate all tests with an uncaught
exception. The asynchronous test case is responsible to feed the error back to the
callback function on failure.


Usage
-----
1. Create a `test` subdirectory (ie: `mkdir test`)
2. Create a test suite file (ie: `cd test && touch fooTest.js`)
2. Add a test case function to the test suite (for example) :

    this.testBar = function testBar() {
       var hello = "Hello world";
       assert.equal(hello, "Hello world", "some message");
    }

3. Run tests (ie. `node nodunit.js`)


