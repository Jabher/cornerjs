(function(success_callback, max_file_size, fail_callback){
    directive('uploader', function (node) {
        function addClass(node, className){
            var classList = node.className.split(' ').filter(function(value){if (value.length > 0) return value});
            if (classList.indexOf(className) == -1) {
                classList.push(className)
            }
            node.className = classList.join(' ');
        }
        function removeClass(node, className){
            var classList = node.className.split(' ').filter(function(value){if (value.length > 0) return value});
            classList = classList.filter(function(value){
                if (className != value) return value
            });
            node.className = classList.join(' ');
        }
        if (FileReader) {
            node.addEventListener('dragover', function (e) {
                e.preventDefault();
                addClass(node, 'dragover');
                return false;
            }, false);
            node.addEventListener('dragleave', function (e) {
                e.preventDefault();
                removeClass(node, 'dragover');
                return false;
            }, false);
            node.addEventListener('drop', function (e) {
                e.preventDefault();
                removeClass(node, 'dragover');

                Array.prototype.forEach.call(e.originalEvent.dataTransfer.files, function (file) {
                    if (!max_file_size || (file.size <= max_file_size)) {
                        if (success_callback) success_callback(file)
                    } else {
                        if (fail_callback) fail_callback(file)
                    }
                });

                return false;
            }, false);
        }
    })
})(function(file){
    var reader = new FileReader();
    reader.onload = function (event) {
        console.log(event.currentTarget.result)
    };
    reader.readAsDataURL(file);
}, 5 * 1024 * 1024);