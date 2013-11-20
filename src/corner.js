window['directive'] = (function () {
    "use strict";
    var ignoredAttributes = ['id', 'href', 'style', 'class', 'src'],
        prefixList = ['data-', 'directive-', ''],
        directiveAliasList = {},
        directives = {},
        body = document.body,
        $ = body.querySelectorAll.bind(body),
        observer;

    function uniq(array) {
        return array.filter(function (a, b, c) {
            return c.indexOf(a, b + 1) === -1
        });
    }

    function getScopeName(directive) {
        return 'directive' + directive.name.replace(/^./, function (s) {
            return s.toUpperCase()
        });
    }

    function smartEval(value) {
        try {
            value = eval('({' + value + '})')
        } catch (e) {
            try {
                value = eval('(' + value + ')')
            } catch (e) {
            }
        }
        return value
    }

    function executeDirectiveCallback(callback, args) {
        if (callback) {
            args[0] = args[0].elementScopes.get(args[1]);
            try {
                callback.apply.apply(callback.call, arguments);
            } catch (e) {
                setTimeout(function () {throw e});
            }
        }
    }

    function getAttributesObject(node) {
        var object = {};
        for (var i = 0; i < node.attributes.length; i++) {
            var attribute = node.attributes[i];
            object[attribute.name] = smartEval(attribute.value);
        }
        return object;
    }

    function directiveLoadedAction(directive, node) {
        if (!directive.elementScopes.has(node)) {
            directive.elementScopes.set(node, node[getScopeName(directive)] = {});
            executeDirectiveCallback(directive.onLoad, arguments);
        }
    }

    function directiveAlteredAction(directive, node) {
        if (directive.elementScopes.has(node)) {
            executeDirectiveCallback(directive.onAlter, arguments);
        }
    }

    function directiveRemovedAction(directive, node) {
        if (directive.elementScopes.has(node)) {
            executeDirectiveCallback(directive.onUnload, arguments);
            directive.elementScopes.delete(node);
        }
    }

    function classAdded(node, className) {
        var directive = directiveAliasList[className.toLowerCase()];
        if (directive) {
            directiveLoadedAction(directive, node, undefined);
        }
    }

    function classRemoved(node, className) {
        var directive = directiveAliasList[className.toLowerCase()];
        if (directive) {
            directiveRemovedAction(directive, node, undefined);
        }
    }

    function attributeAdded(node, attributeName) {
        var directive = directiveAliasList[attributeName.toLowerCase()];
        if (directive) {
            directiveLoadedAction(directive, node, smartEval(node.attributes[attributeName].value));
        }
    }

    function attributeRemoved(node, attributeName) {
        var directive = directiveAliasList[attributeName.toLowerCase()];
        if (directive) {
            directiveRemovedAction(directive, node, undefined);
        }
    }

    function attributeChanged(node, attributeName) {
        var directive = directiveAliasList[attributeName.toLowerCase()];
        if (directive) {
            directiveAlteredAction(directive, node, smartEval(node.attributes[attributeName].value));
        }
    }

    function nodeAdded(node) {
        var directive = directiveAliasList[ node.tagName.toLowerCase() ];
        if (directive) {
            node.addEventListener('attributeChanged', function () {
                directiveAlteredAction(directive, node, getAttributesObject(node))
            });
            directiveLoadedAction(directive, node, getAttributesObject(node))
        }
    }

    function nodeRemoved(node) {
        var directive = directiveAliasList[ node.tagName.toLowerCase() ];
        if (directive) {
            directiveLoadedAction(directive, node, getAttributesObject(node))
        }
    }


    function nodeListAdded(nodeList) {
        var i, j;
        for (i = 0; i < nodeList.length; i++) {
            var node = nodeList[i];
            if (node.tagName) {
                nodeAdded(node);
            }
            if (node.className) {
                var classList = node.className.split(' ').filter(function (a) {
                    return a.length
                });
                for (j = 0; j < classList.length; j++) {
                    classAdded(node, classList[j]);
                }
            }
            if (node.attributes) {
                for (j = 0; j < node.attributes.length; j++) {
                    if (ignoredAttributes.indexOf(node.attributes[j].name) === -1) {
                        attributeAdded(node, node.attributes[j].name);
                    }
                }
            }
        }


        for (i = 0; i < nodeList.length; i++) {
            var node = nodeList[i];
            for (i = 0; i < nodeList.length; i++) {
                if (nodeList[i].children) {
                    nodeListAdded(nodeList[i].children)
                }
            }
        }
    }

    function nodeListRemoved(nodeList) {
        var i, j;
        for (i = 0; i < nodeList.length; i++) {
            if (nodeList[i].children) {
                nodeListRemoved(nodeList[i].children)
            }
        }
        for (i = 0; i < nodeList.length; i++) {
            var node = nodeList[i];
            if (node.tagName) {
                nodeRemoved(node);
            }
            if (node.className) {
                var classList = node.className.split(' ').filter(function (a) {
                    return a.length
                });
                for (j = 0; j < classList.length; j++) {
                    classRemoved(node, classList[j]);
                }
            }
            if (node.attributes) {
                for (j = 0; j < node.attributes.length; j++) {
                    if (ignoredAttributes.indexOf(node.attributes[j].name) === -1) {
                        attributeRemoved(node, node.attributes[j].name);
                    }
                }
            }
        }

    }

    function classMutated(mutationRecord) {
        var oldClassList = uniq((mutationRecord.oldValue || '').split(' ').filter(function (a) {
                return a.length
            })),
            newClassList = uniq((mutationRecord.target.className || '').split(' ').filter(function (a) {
                return a.length
            })),
            diff = {
                removedList: oldClassList.filter(function (a) {
                    return newClassList.indexOf(a) === -1
                }),
                addedList: newClassList.filter(function (a) {
                    return oldClassList.indexOf(a) === -1
                })
            };
        diff.removedList.forEach(function (removedClass) {
            classRemoved(mutationRecord.target, removedClass)
        });
        diff.addedList.forEach(function (addedClass) {
            classAdded(mutationRecord.target, addedClass)
        });
    }

    function attributeMutated(mutationRecord) {
        if (ignoredAttributes.indexOf(mutationRecord.attributeName) !== -1) {
            return
        }
        mutationRecord.target.dispatchEvent(new CustomEvent('attributeChanged', {bubbles: false}));
        if (mutationRecord.oldValue === null) {
            attributeAdded(mutationRecord.target, mutationRecord.attributeName)
        } else if (!mutationRecord.target.attributes[mutationRecord.attributeName]) {
            attributeRemoved(mutationRecord.target, mutationRecord.attributeName)
        } else {
            attributeChanged(mutationRecord.target, mutationRecord.attributeName)
        }
    }

    var oberverLaunched = false;

    function mutationRecordProcessor(mutationRecord) {
        switch (mutationRecord.type) {
            case 'childList':
                nodeListAdded(mutationRecord.addedNodes);
                nodeListRemoved(mutationRecord.removedNodes);
                break;
            case 'attributes':
                if (mutationRecord.attributeName === 'class') {
                    classMutated(mutationRecord)
                } else {
                    attributeMutated(mutationRecord)
                }
                break;
        }
    }

    (function (callback) {
        if (document.readyState === 'complete') {
            callback()
        } else {
            document.addEventListener('DOMContentLoaded', callback, false);
        }
    })(function () {
        observer = new MutationObserver(function (mutationRecordList) {
            for (var i = 0; i < mutationRecordList.length; i++) {
                mutationRecordProcessor(mutationRecordList[i]);
            }
        });
        observer.observe(body, {
                attributeOldValue: true,
                attributes: true,
                childList: true,
                subtree: true
            });
        nodeListAdded([body]);
    });

    var spaceRegex = /\s/;
    return (function (name, options) {
        if ((typeof name !== 'string') || spaceRegex.test(name)) {
            throw new TypeError('Directive name should be a string without spaces')
        }

        name = name.toLowerCase();
        if (typeof options === 'function') {
            options = {load: options};
        }

        var directive = {
                name: name,
                onLoad: options['load'] || options['alter'],
                onUnload: options['unload'],
                onAlter: options['alter'],
                elementScopes: new WeakMap()
            },
            aliases = prefixList.map(function (p) {
                return p + name
            });
        aliases.forEach(function (alias) {
            directiveAliasList[alias] = directive;
        });
        directives[name] = directive;
        if (observer) {
            aliases.forEach(function (className) {
                var nodes = $('.' + className) || [];
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    classAdded(node, className)
                }
            });
            aliases.forEach(function (attrName) {
                var nodes = $('[' + attrName + ']') || [];
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    attributeAdded(node, attrName)
                }
            });
            aliases.forEach(function (tagName) {
                var nodes = $(tagName) || [];
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    nodeAdded(node)
                }
            });
        }
        return name
    }).bind(this);
}).call(window);