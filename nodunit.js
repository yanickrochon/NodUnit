/**
 * Copyright (c) 2010, yanick.rochon@mind2soft.com
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 
 * - Redistributions of source code must retain the above copyright notice, 
 *   this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, 
 *   this list of conditions and the following disclaimer in the documentation 
 *   and/or other materials provided with the distribution.
 * - Neither the name of the <ORGANIZATION> nor the names of its contributors
 *   may be used to endorse or promote products derived from this software 
 *   without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" 
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE 
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE 
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE 
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF 
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS 
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN 
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */



/**
 * The path where tested should be loaded
 *
 * @var string
 */
var TEST_DIR = __dirname + '/test';
/**
 * The log file to use. Set null to prevent result logging.
 * Logs are saved in JSON format.
 *
 * @var string
 */
var LOG_FILE = 'test.log.js';
/**
 * Tell whether to echo output to stdout or not
 *
 * @var boolean
 */
var LOG_OUTPUT = true;
/**
 * The timeout (in milliseconds) before waiting for asynchronous tests to
 * complete. Any test beyond this timeout will be considered as failed.
 *
 * @var int
 */
var ASYNC_TIMEOUT = 30000;


// #####################################
//    Do not change values below this
// #####################################

// test case status codes
var TEST_STATUS_PENDING = null;
var TEST_STATUS_RUNNING = 'running';
var TEST_STATUS_SUCCESS = 'succcess';
var TEST_STATUS_FAILED  = 'failed';
var TEST_STATUS_SKIPPED = 'skipped';

// assertion types addon
var ERR_TYPE_SKIPPED = 'SkipTest';

/**
 * This array will be populated by test results
 */
var TEST_RESULTS = [];


var util = require('util');
var fs   = require('fs');

// assert is global
global.assert = require('assert');

// add skip assertion
global.assert.skip = function(message) {
    throw {
        name: ERR_TYPE_SKIPPED,
        message: message
    };
}


/**
 * Any uncaught exception should terminate the tests immediately.
 * This function is a failsafe to exit on unhandled exceptions.
 */
process.on('uncaughtException', function(e) {
    if (typeof e == 'string' || !e.stack) e = new Error(e + " (Tip: throw Error objects to get a better stack trace!)");
    console.error("Uncaught " + e.stack);
    console.warn("Tests failed! Execution Aborted");
    process.exit(1);
});

/**
 * Whenever the program ends, save the accumulated results
 */
process.on('exit', function() {
    if (LOG_FILE) {
        var header = "//\n"
                   + "// Log file created on " + Date() + "\n"
                   + "//\n";
        if (fs.writeFileSync(LOG_FILE, header + JSON.stringify(TEST_RESULTS, null, 2))) {
            console.warn("Could not log results to %s", LOG_FILE);
        }
    }
});

/**
 * In-house implementation of console.log(), but we do not send
 * new lines to the output stream.
 *
 * Usage : log(msg[, ...]);
 *
 * @param msg string               message
 * @param ...           (optional) arguments
 */
function log(msg) {
    if (LOG_OUTPUT && (msg !== undefined)) {
        var args = Array.prototype.slice.call(arguments, 1);

        if (args.length > 0) {
            msg = util.format.apply(util, arguments);
        }
        util.print(msg);
    }
}

/**
 * For convenience, same as log(msg[, ...]) but with a new line
 * caracter happened to the message
 *
 * Usage : logln(msg[, ...]);
 *
 * @param msg string               message
 * @param ...           (optional) arguments
 */
function logln(msg) {
    if (msg === undefined) {
        log("\n");
    } else {
        var args = Array.prototype.slice.call(arguments, 0);

        args[0] = msg + "\n";
        log.apply(global, args);
    }
}



// scan directory recursively for tests
var fs = require('fs');
(function scanTestSuites(dir, done) {
    var suites = [];
    fs.readdir(dir, function(err, list) {
        if (err) return done(err);
        var i = 0;
        (function next() {
            var file = list[i++];
            if (!file) return done(null, suites);
            file = dir + '/' + file;
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    scanTestSuites(file, function(err, res) {
                        suites = suites.concat(res);
                        next();
                    });
                } else if (/^.*?Test.js/.test(file)) {
                    var module = file.substr(0, file.length - 3);
                    suites.push(module);
                    next();
                }
            });
        })();
    });
})(TEST_DIR, function(err, suites) {
    if (err) {
        logln("ERROR : Could not read test directory : %s\n", err.path);
        process.exit(1);
    }

    process.nextTick(function() {
        endTests(startTests(suites));
    });
});

/**
 * Start test by iterating over all test suites
 *
 * @param suites array     an array of modules to test (string)
 * @return array           an array of test results
 */
function startTests(suites) {
    if (suites.length > 0) {
        for (var i=0, len=suites.length; i<len; i++) {
            var result = runTestSuite(suites[i]);
            TEST_RESULTS.push(result);
            logln();
        }
    }
    
    return TEST_RESULTS;
};

/**
 * Run all test cases for the given test suite
 *
 * @param module string      the test module
 * @return object            the result
 */
function runTestSuite(module) {
    var result = {
        module: module.substr(TEST_DIR.length + 1, module.length - TEST_DIR.length - 5),
        tests: [],
        aborted: false
    };

    var tObj, testResult;
    try {
        logln("Initializing test suite for '%s'", result.module);
        tObj = require(module);

        if (typeof tObj.setup == 'function') tObj.setup();

        for (var prop in tObj) {
            if (/^test/.test(prop) && typeof tObj[prop] == 'function') {
                testResult = {
                    testCase: prop.substr(4),
                    status: TEST_STATUS_PENDING,
                    timeStart: 0,  // set just before doing actual test
                    execTime: 0
                };
                result.tests.push(testResult);
                runTestCase(result.module, tObj, prop, testResult);
            }
        }
        
        if (result.tests.length == 0) {
            logln("No test found!");
        }

    } catch (e) {
        console.warn(e);
        result.aborted = true;
    } finally {
        if (tObj && tObj.teardown && typeof tObj.teardown == 'function') {
            try {
                tObj.teardown();
            } catch (e) {
                console.warn(e);
            }
        }
    }
    
    return result;
}

/**
 * Run the given test case for the specified module and modify the 
 * given result object. This function might return right away if the
 * given test case is detected to be asyinchronous, thus the function
 * does not return anything.
 *
 * @param module string       the module name
 * @param tObj object         the test module object
 * @param tc string           the test case function name
 * @param result object       the result object
 */
function runTestCase(module, tObj, tc, result) {
    var err = false;
    var status = 'OK';
    var async = !!tObj[tc].length;  // async if the function has at least 1 argument
    
    if (!async && tObj.beforeTest && typeof tObj.beforeTest == 'function') {
        try {
            tObj.beforeTest();
        } catch (e) {
            console.warn(e);
            result.status = TEST_STATUS_SKIPPED;
            return;
        }
    }
    
    var _done = function() {
        result.execTime = +new Date() - result.timeStart;
        logln(" %s (%d ms)", status, result.execTime);
        if (err) {
            console.warn(err);
        }
    };

    result.timeStart = +new Date();
    try {
        if (async) {
            logln("Testing '%s' (async start)...", tc.substr(4));
            tObj[tc](function(err) {
                if (result.status == TEST_STATUS_PENDING) {  // if index == -1, then the test had timed out...
                    if (err) {
                        result.status = TEST_STATUS_FAILED;
                        result.error = convertErrorToObject(err);
                        status = 'Failed';
                    } else {
                        result.status = TEST_STATUS_SUCCESS;
                    }
                    log("    ... '%s.%s' (async end)...", module, tc.substr(4));
                    _done();
                }
            });
        } else {        
            log("Testing '%s'...", tc.substr(4));
            tObj[tc]();
            result.status = TEST_STATUS_SUCCESS;
        }
    } catch (e) {
        err = formatTestCaseExceptionMessage(e);
        if (e.name && e.name == ERR_TYPE_SKIPPED) {
            result.status = TEST_STATUS_SKIPPED;
            status = 'Skipped';
        } else {
            result.status = TEST_STATUS_FAILED;
            result.error = e;
            status = 'Failed';
        }
    } finally {
        if (!async) {
            _done();
        }
    }
    
    if (!async && tObj.afterTest && typeof tObj.afterTest == 'function') {
        try {
            tObj.afterTest();
        } catch (e) {
            console.warn(e);
        }
    }
}

/**
 * Utility function to format the given test error message into a human readable format
 *
 * @param e string|Error
 * @return string
 */
function formatTestCaseExceptionMessage(e) {
    if (e && e.message !== undefined && e.actual !== undefined && e.expected !== undefined && e.operator !== undefined) {
        return util.format("Assertion failed : %s : (act) %d %s %d (exp)", e.message, e.actual, e.operator, e.expected);
    } else if (e && e.name == ERR_TYPE_SKIPPED) {
        return "Skip reason : " + e.message;
    } else {
        return "Exception : " + e;
    }
}

/**
 * Utility function to convert Error objects to a conventional object
 * so it can be logged
 */
function convertErrorToObject(err) {
    if (err.stack) {
        var obj = {
            message: err.message,
            type: err.type ? err.type : 'Error',
            stack: err.stack.split(/\n\s+at\s+/).slice(1),
            arguments: err.arguments
        };
        for (var prop in err) {
            obj[prop] = err[prop];
        }
        err = obj;
    }
    return err;
}

/**
 * Terminate all tests. This function may be run asynchronously if there
 * are some asynchronous tests still running.
 *
 * @param results array         an array of test results
 */
function endTests(results) {
    var total = {
        success: 0,
        failed: 0,
        skipped: 0,
        aborted: 0,
        execTime: 0
    };

    var _done = function() {
        var r;
        for (var i=0, len=results.length; i<len; i++) {
            r = results[i];

            for (var j=0, rlen=r.tests.length; j<rlen; j++) {
                switch (r.tests[j].status) {
                    case TEST_STATUS_SUCCESS:
                        total.success++;
                        break;
                    case TEST_STATUS_FAILED:
                        total.failed++;
                        break;
                    case TEST_STATUS_SKIPPED:
                        total.skipped++;
                        break;
                    case TEST_STATUS_PENDING:
                    default:
                        break;
                }
                total.execTime += r.tests[j].execTime;
            }

            if (r.aborted) {
                total.aborted++;
            }
        }

        logln("Total : %d tested (%d success, %d failed, %d skipped) %d aborted in %d ms",
            total.success + total.failed + total.skipped,
            total.success, total.failed, total.skipped, total.aborted, total.execTime);
            
        process.exit(total.failed || total.failed || total.aborted);
    }

    var lastCount = 0;
    // check that all tests have completed, or wait for async ones
    (function _check() {
        var runningCount = 0;
        var tcur = +new Date(), tcurr;
        for (var i=0, len=results.length; i<len; i++) {
            for (var j=0, rlen=results[i].tests.length; j<rlen; j++) {
                if (results[i].tests[j].status == TEST_STATUS_PENDING) {
                    if ((tcurr = tcur - results[i].tests[j].timeStart) > ASYNC_TIMEOUT) {
                        logln("    ... '%s.%s' (async end)... Timeout after %d ms", results[i].module, results[i].tests[j].testCase, tcurr);
                        results[i].tests[j].status = TEST_STATUS_FAILED;
                        results[i].tests[j].error = "AsyncTimeout";
                        results[i].tests[j].execTime = tcurr;
                    } else {
                        runningCount++;
                    }
                }
            }
        }
        
        if (runningCount == 0) {
            _done();
        } else {
            if (runningCount != lastCount) {
                logln("Waiting %s async tests to terminate...", runningCount);
                lastCount = runningCount;
            }
            process.nextTick(_check);
        }
    })();
}

