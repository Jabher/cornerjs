module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                separator: ';'
            },
            dist: {
                src: [
                    'src/WeakMap-polyfill.js',
                    'src/MutationObserver-polyfill.js',
                    'src/corner.js'
                ],
                dest: 'build/<%= pkg.name %>'
            }
        },
        uglify: {
            my_target: {
                files: {
                    'build/corner.min.js': [ 'build/corner.js' ]
                }
            },
            options: {
                compress: {},
                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                    '<%= grunt.template.today("yyyy-mm-dd") %> */'
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.registerTask('compile', ['concat', 'uglify']);
};
