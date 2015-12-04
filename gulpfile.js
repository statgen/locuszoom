var gulp = require('gulp');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var notify = require('gulp-notify');
var watch = require('gulp-watch');

// App-specific JS files to be watched and uglified
// NOTE: Order of inclusion is important!
var app_js_files = ['./assets/js/app/Locuszoom.js',
                    './assets/js/app/Data.js',
                    './assets/js/app/Instance.js',
                    './assets/js/app/Panel.js',
                    './assets/js/app/DataLayer.js'
                   ];

// Uglify all the javascripts
gulp.task('js', function() {
    gulp.start('app_js', 'vendor_js');
});

// Uglify all app-specific JS libraries into a single app file
gulp.task('app_js', function() {
    gulp.src(app_js_files)
        .pipe(uglify())
        .pipe(concat("locuszoom.app.min.js"))
        .pipe(gulp.dest('./assets/js'))
        .pipe( notify({ message: "Generated locuszoom.app.min.js"}) );
});

// Uglify vendor js files into a single vendor file
gulp.task('vendor_js', function() {
    gulp.src('./assets/js/vendor/*.js')
        .pipe(uglify())
        .pipe(concat("locuszoom.vendor.min.js"))
        .pipe(gulp.dest('./assets/js'))
        .pipe( notify({ message: "Generated locuszoom.vendor.min.js"}) );
});

// Watch all the things
gulp.task('watch', function() {
    gulp.watch(app_js_files, ['app_js']);
});

gulp.task('default', ['js', 'watch']); 
