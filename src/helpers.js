function set_node_content(node, content, overwrite) {
    if (overwrite) {
        node.innerHTML = content
    } else {
        node.insertAdjacentHTML('beforeend', content)
    }
}

$ajax = function (method, path, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4) {
            if (xmlhttp.status == 200) {
                if (callback) {
                    callback.call(xmlhttp, xmlhttp.responseText)
                }
            } else {
                console.error(path + ' is not reachable');
            }
        }
    };
    xmlhttp.open(method, path, true);
    xmlhttp.send();
};
$ajax.get = function (path, callback) {
    this('GET', path, callback)
};
$ajax.post = function (path, callback) {
    this('POST', path, callback)
};





function smart_eval(content){
    var output;
    try {
        output = eval('({' + content + '})');
    } catch (exception) {
        try {
            output = eval(content)
        } catch (exception) {
            output = content;
        }
    }
    return output;
}