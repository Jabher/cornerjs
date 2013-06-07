module.exports = function (grunt) {

    grunt.initConfig({
        pkg   : grunt.file.readJSON('package.json'),
        concat: {
            options: {
                // define a string to put between each file in the concatenated output
                separator: ';'
            },
            dist   : {
                // the files to concatenate
                src : [
                    'src/EC5-polyfills.js',
                    'src/WeakMap-polyfill.js',
                    'src/MutationObserver-polyfill.js',
                    'src/corner.js'
                ],
                // the location of the resulting JS file
                dest: 'build/<%= pkg.name %>'
            }
        },
        uglify: {
            my_target: {
                files: {
                    'build/corner.min.js': [
                        'build/corner.js'
                    ]
                }
            },
            options  : {
                compress: true,

                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                    '<%= grunt.template.today("yyyy-mm-dd") %> */'
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.registerTask('compile', ['concat', 'uglify']);
};