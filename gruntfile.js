module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        coffee: {
            compile: {
                files: {
                    'build/corner.core.js': 'src/corner.coffee'
                }
            }
        },
        concat: {
            options: {
                separator: ';'
            },
            dist: {
                src: [
                    'src/WeakMap-polyfill.js',
                    'src/MutationObserver-polyfill.js',
                    'build/corner.core.js'
                ],
                dest: 'build/<%= pkg.name %>'
            }
        },
        uglify: {
            my_target: {
                files: {
                    'build/corner.min.js': [ 'build/corner.js' ],
                    'build/corner.core.min.js': [ 'build/corner.core.js' ]
                }
            },
            options: {
                compress: true,
                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                    '<%= grunt.template.today("yyyy-mm-dd") %> */'
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-coffee');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.registerTask('compile', ['coffee', 'concat', 'uglify']);
};