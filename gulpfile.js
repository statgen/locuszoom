/* eslint-env node */
var fs = require('fs');
var path = require('path');

var gulp = require('gulp');
var concat = require('gulp-concat');
var eslint = require('gulp-eslint');
var filter = require('gulp-filter');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var wrapJS = require('gulp-wrap-js');

var del = require('del');
var argv = require('yargs').argv;

var files = require('./files.js');
var manifest = require('./package.json');

var mainFile = manifest.main;
var destinationFolder = path.dirname(mainFile);

// Remove all existing built assets
gulp.task('clean', function() {
    return del([destinationFolder]);
});

// Perform syntax checking on all files
gulp.task('lint', function() {
    return gulp.src(['**/*.js', '!node_modules/**', '!examples/**'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

// Run Mocha unit tests (iff linting passes first)
gulp.task('test', gulp.parallel('lint', function () {
    return gulp.src(files.test_suite)
        .pipe(mocha())
        .on('end', function() {
            if (this.failed) {
                gutil.log(gutil.colors.bold.white.bgRed(' Tests failed! '));
            } else {
                gutil.log(gutil.colors.bold.white.bgGreen(' All tests passed! '));
            }
        })
        .on('error', function (err) {
            console.error(err);
            if (argv.force) {
                // Note: If running gulp via npm script, npm will intercept "--force" and not pass it to gulp
                this.failed = true;
                this.emit('end');
            } else {
                gutil.log(gutil.colors.bold.white.bgRed(' Tests failed! '));
            }
        });
}));

// Concatenate all app-specific JS libraries into unminified and minified single app files
gulp.task('app_js', function() {
    var moduleTemplate = fs.readFileSync('./assets/js/app/wrapper.txt', 'utf8');
    return gulp.src(files.app_build)
        .pipe(sourcemaps.init())
        .pipe(concat('locuszoom.app.js'))
        .pipe(wrapJS(moduleTemplate))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(destinationFolder))
        // Then make .min.js
        .pipe(filter(['**', '!**/*.js.map']))
        .pipe(rename('locuszoom.app.min.js'))
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(wrapJS(moduleTemplate))
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(destinationFolder))
        .on('end', function() {
            gutil.log(gutil.colors.bold.white.bgBlue(' Generated locuszoom.app.js bundles '));
        }).on('error', function() {
            gutil.log(gutil.colors.bold.white.bgRed(' FAILED to generate locuszoom.app.js bundles '));
        });
});

// Provide minified versions of each optional extension, separate from the main bundle
gulp.task('ext_js', function() {
    return gulp.src(files.extensions)
        .pipe(rename(function (fn) {
            fn.extname = '.min.js';
        }))
        .pipe(sourcemaps.init())
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(path.join(destinationFolder, 'ext')))
        .on('end', function() {
            gutil.log(gutil.colors.bold.white.bgBlue(' Generated minified extensions '));
        }).on('error', function() {
            gutil.log(gutil.colors.bold.white.bgRed(' FAILED to generate minified extensions '));
        });
});

// Concatenate vendor js files into a single vendor file
gulp.task('vendor_js', function() {
    return gulp.src(files.vendor_build)
        .pipe(sourcemaps.init())
        .pipe(concat('locuszoom.vendor.min.js'))
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(destinationFolder))
        .on('end', function() {
            gutil.log(gutil.colors.bold.white.bgBlue('Generated locuszoom.vendor.min.js'));
        })
        .on('error', function() {
            gutil.log(gutil.colors.bold.white.bgRed('FAILED to generate locuszoom.vendor.min.js'));
        });
});

// Test app files, then build both app and vendor javascript files if all tests pass (DEPRECATED)
gulp.task('js', gulp.parallel('app_js', 'ext_js', 'vendor_js'));

// Build CSS
gulp.task('css', function() {
    return gulp.src('./assets/css/*.scss')
        .pipe(sass())
        .pipe(gulp.dest(destinationFolder))
        .on('end', function() {
            gutil.log(gutil.colors.bold.white.bgBlue('Generated locuszoom.css'));
        })
        .on('error', function() {
            gutil.log(gutil.colors.bold.white.bgRed('FAILED to generate locuszoom.css'));
        });
});

// Watch for changes in app source files to trigger fresh builds
gulp.task('watch', function() {
    gutil.log(gutil.colors.bold.black.bgYellow('Watching for changes in app and test files...'));
    gulp.watch(files.app_build.concat(files.extensions, files.test_suite), gulp.series('test', gulp.parallel('app_js', 'ext_js')));
    gulp.watch(['./assets/css/*.scss'], gulp.series('css'));
});

// Default task: do a clean build of all assets, and ensure tests + linting pass (suitable for making a release)
gulp.task('build', gulp.series('clean', 'test', gulp.parallel('js', 'css')));

gulp.task('default', gulp.parallel('build'));
