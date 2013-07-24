directive('include', {alter: function (node, path) {
    (function (xmlhttp) {
        xmlhttp.onreadystatechange = function () {
            if ((xmlhttp.readyState == 4) && (xmlhttp.status == 200))
                node.innerHTML = xmlhttp.responseText
        };
        xmlhttp.open('GET', path, true);
        xmlhttp.send();
    })(new XMLHttpRequest)
}});


Object.defineProperty(Number.prototype, 'times', {
    get: function () {
        return function (callback) {
            for (var i = 0; i < this; i++) {
                callback(i)
            }
        }
    }
});
directive('repeat', {
        load: function (node, count) {
            window.repeatNode = node;
            if (node.isClone) return;
            this.operator = node;
            this.originalElement = node.cloneNode(true);
            this.operator.className = 'repeatOperator';
            this.operator.style.display = 'none';
            this.parent = node.parentElement;

            this.cloneList = [];
            count.times((function () {
                var clone = this.originalElement.cloneNode(true);
                this.parent.insertBefore(clone, this.operator);
                clone.isClone = true;
                clone.sourceNode = node;
                this.cloneList.push(clone)
            }).bind(this))
        },
        alter: function (node, count) {
            if (node.isClone) {
                if (node.sourceNode.attributes.getNamedItem('repeat'))
                    node.sourceNode.attributes.getNamedItem('repeat').value = count;
            } else {
                console.log(this);
                this.cloneList.forEach(function (clone) {
                    clone.remove()
                });

                this.cloneList = [];
                this.originalElement.attributes.getNamedItem('repeat').value = count;
                count.times((function () {
                    var clone = this.originalElement.cloneNode(true);
                    this.parent.insertBefore(clone, this.operator);
                    clone.isClone = true;
                    clone.sourceNode = node;
                    this.cloneList.push(clone)
                }).bind(this))
            }
        }
    }
);