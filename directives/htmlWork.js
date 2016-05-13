directive('include', {alter: function (node, path) {
    (function (xmlhttp) {
        xmlhttp.onreadystatechange = function () {
            if ((xmlhttp.readyState == 4) && (xmlhttp.status == 200)) node.innerHTML = xmlhttp.responseText
        };
        xmlhttp.open('GET', path, true);
        xmlhttp.send();
    })(new XMLHttpRequest)
}});


Object.defineProperty(Number.prototype, 'times', {
    get: function () {
        return function (callback) {
            var i;
            var numericValue = this;
            var returnArray = [];
            for (i = 0; i < numericValue; i++) {
                returnArray.push(callback(i))
            }
            return returnArray
        }
    }
});
Object.defineProperty(Object.prototype, 'do', {
    value: function (callback) {
        callback(this);
        return this
    }
});
directive('repeat', {
        load: function (node, count) {
            if (node.sourceNode) return;
            var cloneList = [],
                originalElement = node.cloneNode(true);
            node.className += ' repeatOperator';
            node.style.display = 'none';
            this.fillWithClones = function (count) {
                if (count.times) {
                    originalElement.attributes.getNamedItem('repeat').value = count;
                    cloneList.forEach(function (clone) {
                        clone.remove()
                    });
                    cloneList = count.times(function () {
                        return originalElement.cloneNode(true).do(function (clone) {
                            node.parentElement.insertBefore(clone, node);
                            clone.sourceNode = node;
                        });
                    })
                } else {
                    throw new TypeError(count + ' is not a number')
                }
            };
            this.fillWithClones(count);
        },
        alter: function (node, count) {
            if (node.sourceNode) {
                if (node.sourceNode.attributes.getNamedItem('repeat'))
                    node.sourceNode.attributes.getNamedItem('repeat').value = count;
            } else {
                this.fillWithClones(count)
            }
        }, unload: function (node) {
            if (!node.sourceNode) {
                node.className = node.className.replace(' repeatOperator', '');
                node.style.display = 'block';
                this.fillWithClones(0);
            } else {
                node.sourceNode.attributes.removeNamedItem('repeat');
            }
        }
    }
);
