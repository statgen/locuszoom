/* global require */
/* eslint-disable no-console */

var gulp = require("gulp");
var gutil = require("gulp-util");
var uglify = require("gulp-uglify");
var sass = require("gulp-sass");
var concat = require("gulp-concat");
var wrap = require("gulp-wrap");
var mocha = require("gulp-mocha");
var argv = require("yargs").argv;
var files = require("./files.js");

// Test app files, then build both app and vendor javascript files if all tests pass
gulp.task("js", function() {
    return gulp.start("app_js", "vendor_js");
});

// Run Mocha unit tests
gulp.task("test", function () {
    return gulp.src(files.test_suite)
        .pipe(mocha())
        .on("end", function() {
            if (this.failed){
                gutil.log(gutil.colors.bold.white.bgRed(" Tests failed! "));
            } else {
                gutil.log(gutil.colors.bold.white.bgGreen(" All tests passed! "));
            }
        })
        .on("error", function (err) {
            console.error(err);
            if (argv.force){
                this.failed = true;
                this.emit("end");
            } else {
                gutil.log(gutil.colors.bold.white.bgRed(" Tests failed! "));
            }
        });
});

// Concatenate all app-specific JS libraries into unminified and minified single app files
gulp.task("app_js", ["test"], function() {
    gulp.src(files.app_build)
        .pipe(concat("locuszoom.app.js"))
        .pipe(wrap({ src: "./assets/js/app/wrapper.js"}))
        .pipe(gulp.dest("."))
        .on("end", function() {
            gutil.log(gutil.colors.bold.white.bgBlue(" Generated locuszoom.app.js "));
        })
        .on("error", function() {
            gutil.log(gutil.colors.bold.white.bgRed(" FAILED to generate locuszoom.app.js "));
        });
    gulp.src(files.app_build)
        .pipe(concat("locuszoom.app.min.js"))
        .pipe(wrap({ src: "./assets/js/app/wrapper.js"}))
        .pipe(uglify())
        .pipe(gulp.dest("."))
        .on("end", function() {
            gutil.log(gutil.colors.bold.white.bgBlue(" Generated locuszoom.app.min.js "));
        })
        .on("error", function() {
            gutil.log(gutil.colors.bold.white.bgRed(" FAILED to generate locuszoom.app.min.js "));
        });
});

// Concatenate vendor js files into a single vendor file
gulp.task("vendor_js", function() {
    return gulp.src(files.vendor_build)
        .pipe(concat("locuszoom.vendor.min.js"))
        .pipe(gulp.dest("."))
        .on("end", function() {
            gutil.log(gutil.colors.bold.white.bgBlue("Generated locuszoom.vendor.min.js"));
        })
        .on("error", function() {
            gutil.log(gutil.colors.bold.white.bgRed("FAILED to generate locuszoom.vendor.min.js"));
        });
});

// Build CSS
gulp.task("css", function() {
    return gulp.src("./assets/css/*.scss")
        .pipe(sass())
        .pipe(gulp.dest("."))
        .on("end", function() {
            gutil.log(gutil.colors.bold.white.bgBlue("Generated locuszoom.css"));
        })
        .on("error", function() {
            gutil.log(gutil.colors.bold.white.bgRed("FAILED to generate locuszoom.css"));
        });
});

// Watch for changes in app source files to trigger fresh builds
gulp.task("watch", function() {
    gutil.log(gutil.colors.bold.black.bgYellow("Watching for changes in app and test files..."));
    gulp.watch(files.app_build.concat(files.test_suite), ["app_js"]);
    gulp.watch(["./assets/css/*.scss"], ["css"]);
});


// Default task: make all the javascripts and css
gulp.task("default", ["js", "css"]); 
