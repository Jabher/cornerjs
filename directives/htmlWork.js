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
            var returnArray = [];
            for (var i = 0; i < this; i++) {
                returnArray.push(callback(i))
            }
            return returnArray
        }
    }
});
Object.defineProperty(Object.prototype, 'do', {
    get: function () {
        return function (callback) {
            callback(this);
            return this
        }
    }
});
directive('repeat', {
        load: function (node, count) {
            if (node.sourceNode) return;

            var cloneList = [],
                originalElement = node.cloneNode(true);
            node.className += ' repeatOperator';
            node.style.display = 'none';

            (this.fillWithClones = function (count) {
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
            })(count);
        },
        alter: function (node, count) {
            console.log(this);
            console.log(node);
            if (node.sourceNode) {
                if (node.sourceNode.attributes.getNamedItem('repeat'))
                    node.sourceNode.attributes.getNamedItem('repeat').value = count;
            } else {
                this.fillWithClones(count)
            }
        }
    }
);

directive('repeat-inner', function () {
});


directive('scrollbox', function (node, options) {
    options = options || {};

    var contentHolder = document.createElement('div');
    contentHolder.className = 'content';
    contentHolder.style.position = 'absolute';
    while (node.childNodes.length > 0) {
        contentHolder.appendChild(node.childNodes[0])
    }
    node.style.overflow = 'hidden';
    node.style.position = 'relative';
    node.appendChild(contentHolder);

    var scrollbar = document.createElement('div');
    scrollbar.className = 'scrollbar';
    scrollbar.style.position = 'absolute';
    if (!options.customScrollbar) {
        scrollbar.style.right = '2px';
        scrollbar.style.width = '4px';
        scrollbar.style.background = 'rgba(0,0,0,.5)';
        scrollbar.style.borderRadius = '4px';
    }
    node.appendChild(scrollbar);
    var current_scroll_state = 0;
    var scrollAction = function (q) {
        var contentHeight = contentHolder.offsetHeight,
            containerHeight = node.clientHeight,
            barHeight = containerHeight * (Math.min(containerHeight / contentHeight, 1));

        current_scroll_state -= q;
        current_scroll_state = Math.max(0, current_scroll_state);
        current_scroll_state = Math.min(contentHeight - containerHeight, current_scroll_state);
        contentHolder.style.top = -current_scroll_state + 'px';

        scrollbar.style.height = barHeight + 'px';
        scrollbar.style.top = containerHeight * (current_scroll_state / contentHeight) + 'px';
    };


    var wheelCallback = function (event) {
        event.preventDefault();
        var e = event.originalEvent || event,
            wheelDelta = e.wheelDelta || (-e.detail);
        if (window.opera) {
            wheelDelta = -wheelDelta
        }
        if (wheelDelta < 0) {
            wheelDelta = Math.max(wheelDelta, -3)
        } else {
            wheelDelta = Math.min(wheelDelta, 3)
        }
        scrollAction(wheelDelta * 6);
        return false
    };

    node.addEventListener('mousewheel', wheelCallback);
    node.addEventListener('DOMMouseScroll', wheelCallback);
    node.addEventListener("mousewheel", wheelCallback);



    scrollbar.addEventListener('mousedown', function (initEvent) {
        node.style.webkitUserSelect = node.style.mozUserSelect = node.style.msUserSelect = 'none';
        document.body.style.setProperty('cursor', 'pointer', 'important');
        var currentY = initEvent.screenY;
        var moveAction = function (event) {
            scrollAction(currentY - event.screenY);
            currentY = event.screenY;
        };

        window.addEventListener('mousemove', moveAction, false);
        var detachMoveAction = function () {
            node.style.webkitUserSelect = node.style.mozUserSelect = node.style.msUserSelect = '';
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', moveAction);
            window.removeEventListener('blur', detachMoveAction);
            window.removeEventListener('mouseup', detachMoveAction);
        };
        window.addEventListener('blur', detachMoveAction);
        window.addEventListener('mouseup', detachMoveAction);
    }, false);
    scrollAction(0);
});