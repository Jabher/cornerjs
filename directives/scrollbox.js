directive('scrollbox', function (node, options) {
    options = options || {};

    var contentHolder = document.createElement('div');
    contentHolder.className = 'content';
    contentHolder.style.width = node.offsetWidth + 'px';
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
            wheelDelta = e.wheelDelta || - e.deltaY;
        if (window.opera) {wheelDelta = -wheelDelta;}
        scrollAction(wheelDelta);
        return false;
    };
    if ('onmousewheel' in window) {
        contentHolder.addEventListener('mousewheel', wheelCallback);
    } else {
        contentHolder.addEventListener('wheel', wheelCallback);
    }


    scrollbar.addEventListener('mousedown', function (initEvent) {
        node.style.webkitUserSelect = node.style.mozUserSelect = node.style.msUserSelect = 'none';
        document.body.style.setProperty('cursor', 'pointer', 'important');
        var currentY = initEvent.screenY;

        window.addEventListener('mousemove', moveAction, false);
        window.addEventListener('blur', detachMoveAction);
        window.addEventListener('mouseup', detachMoveAction);

        function moveAction(event) {
            var contentHeight = contentHolder.offsetHeight,
                containerHeight = node.clientHeight,
                scrollOffset = currentY - event.screenY,
                relOffset = scrollOffset / containerHeight;

            scrollAction(contentHeight * relOffset);
            currentY = event.screenY;
        }

        function detachMoveAction() {
            node.style.webkitUserSelect = node.style.mozUserSelect = node.style.msUserSelect = '';
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', moveAction);
            window.removeEventListener('blur', detachMoveAction);
            window.removeEventListener('mouseup', detachMoveAction);
        }
    }, false);
    scrollAction(0);
});