var gulp = require("gulp");
var gutil = require("gulp-util");
var uglify = require("gulp-uglify");
var sass = require("gulp-sass");
var concat = require("gulp-concat");
var wrap = require("gulp-wrap");
var watch = require("gulp-watch");
var mocha = require("gulp-mocha");

// App-specific JS files to be watched and concatenate/minify
// NOTE: Order of inclusion is important!
var app_js_files = ["./assets/js/app/LocusZoom.js",
                    "./assets/js/app/Data.js",
                    "./assets/js/app/Instance.js",
                    "./assets/js/app/Panel.js",
                    "./assets/js/app/DataLayer.js"
                   ];

var test_js_files = ["./test/LocusZoom.js",
                     "./test/Data.js",
                     "./test/Instance.js",
                     "./test/Panel.js"
                    ];

// Test app files, then build both app and vendor javascript files if all tests pass
gulp.task("js", function() {
    gulp.start("app_js", "vendor_js");
});

// Run Mocha unit tests
gulp.task("test", function () {
    return gulp.src(test_js_files)
        .pipe(mocha())
        .on("end", function() {
            gutil.log(gutil.colors.bold.white.bgGreen(" All tests passed! "));
        })
        .on("error", function (err) {
            console.log(err);
            process.exit(1);
        });
});

// Concatenate all app-specific JS libraries into unminified and minified single app files
gulp.task("app_js", ["test"], function() {
    gulp.src(app_js_files)
        .pipe(concat("locuszoom.app.js"))
        .pipe(wrap({ src: "./assets/js/app/wrapper.js"}))
        .pipe(gulp.dest("."))
        .on("end", function() {
            gutil.log(gutil.colors.bold.white.bgBlue(" Generated locuszoom.app.js "));
        })
        .on("error", function() {
            gutil.log(gutil.colors.bold.white.bgRed(" FAILED to generate locuszoom.app.js "));
        });
    gulp.src(app_js_files)
        .pipe(uglify())
        .pipe(concat("locuszoom.app.min.js"))
        .pipe(wrap({ src: "./assets/js/app/wrapper.js"}))
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
    gulp.src("./assets/js/vendor/*.js")
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
    gulp.src("./assets/css/*.scss")
        .pipe(sass())
        .pipe(gulp.dest('.'))
        .on("end", function() {
            gutil.log(gutil.colors.bold.white.bgBlue("Generated locuszoom.css"));
        })
        .on("error", function() {
            gutil.log(gutil.colors.bold.white.bgRed("FAILED to generate locuszoom.css"));
        });
});

// Watch for changes in app source files to trigger fresh builds
gulp.task("watch", function() {
    gutil.log(gutil.colors.bold.black.bgYellow("Watching for changes in app files..."));
    gulp.watch(app_js_files, ["app_js"]);
    gulp.watch(["./assets/css/*.scss"], ["css"]);
});

// Default task: make all the javascripts and css
gulp.task("default", ["js", "css"]); 
