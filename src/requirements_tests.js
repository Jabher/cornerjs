function check_if_exist() {
    if (arguments.length >= 2) {
        var error_message = Array.prototype.pop.call(arguments);
        var valid = true
        Array.prototype.forEach.call(arguments,function (argument) {
            if (argument === undefined || argument === null) {
                valid = false
            }
        });
        if (!valid) {
            console.error(error_message)
        }
        return valid
    }
    return false
}

function check_if_valid() {
    if (arguments.length >= 2) {
        var error_message = Array.prototype.pop.call(arguments);
        var valid = true
        Array.prototype.forEach.call(arguments,function (argument) {
            if (argument === false) {
                valid = false
            }
        });
        if (!valid) {
            console.error(error_message)
        }
        return valid
    }
    return false
}