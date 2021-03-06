/*
 * Gulp file for the Power Dashboard application
 */
var gulp = require('gulp');
var args = require('yargs').argv;
var config = require('./gulp.config')();
var browserSync = require('browser-sync').create();
var port = process.env.PORT || config.defaultPort;

var $ = require('gulp-load-plugins')({lazy: true});

/*
 * Analyze the JavaScript files with JSSC and JSHint
 */
gulp.task('analyze-code', function() {
    log('Analyzing source code with JSHint and JSCS');
    return gulp
        .src(config.alljs)
        .pipe($.plumber())
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jscs())
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish', {verbose: true}))
        .pipe($.jshint.reporter('fail'));
});

/*
 * Deploy the web server files to the production folder
 */
gulp.task('deploy-web', ['analyze-code'], function() {
    log('Deploying the web server files to the production folder');
    return gulp
        .src(config.allwebserverfiles)
        .pipe($.plumber())
        .pipe($.if(args.verbose, $.print()))
        .pipe(gulp.dest(config.productionweb));
});

/*
 * Compile the arduino code located in the src folder
 */
gulp.task('compile-arduino', $.shell.task([
    'platformio run'
]));

/*
 * Deploy the compiled arduino code to the arduino
 */
gulp.task('deploy-arduino', ['compile-arduino'], $.shell.task([
    'platformio run --target upload'
]));

/*
 * Cleanup all the files that were generated by the compilation
 */
gulp.task('clean-arduino', $.shell.task([
    'platformio run --target clean'
]));

/*
 * Cleanup all temporary files
 */
gulp.task('clean', ['clean-arduino']);

/*
 * Start the web server
 */
gulp.task('serve', function (callback) {
    var called = false;
    log('Starting nodemon');
    $.nodemon({
        script: 'server.js',
        cwd: './web',
        ignore: 'public'
    })
    .on('start', function () {
        // Ensure start only got called once
        if (!called) {
            callback();
        }
        called = true;
    })
    .on('restart', function () {
        log('Nodemon restarted!');
        // Reattach the browsers again
        setTimeout(function reload() {
            browserSync.reload({
                stream: false
            });
        }, 500 /* BROWSER_SYNC_RELOAD_DELAY */);
    });
});

/*
 * Inform attached browsers of changes to the web
 */
gulp.task('browser-sync', ['serve'], function() {
    browserSync.init(config.browserSyncOptions);
});

/*
 * The task to run when starting gulp without any specific task to run
 */
gulp.task('default', ['analyze-code']);

/*
 * Function to log a message to the console
 */
function log(message) {
    if (typeof message === 'object') {
        for (var item in message) {
            if (message.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(message[item]));
            }
        }
    } else {
        $.util.log($.util.colors.blue(message));
    }
}

