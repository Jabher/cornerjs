window.directive = (function () {
    if (!window.XMLHttpRequest) {
        throw 'XMLHttpRequest not found'
    }
    if (!window.MutationObserver) {
        //requerments check
        throw 'MutationObserver (or polyfill) not found'
    }
    if (!Array.prototype.indexOf && !Array.prototype.forEach && !Array.prototype.filter) {
        //requerments check
        throw 'Array EC5 extensions (or polyfills) not found'
    }
    NodeList.prototype.forEach = NodeList.prototype.forEach || Array.prototype.forEach;
    HTMLCollection.prototype.forEach = HTMLCollection.prototype.forEach || Array.prototype.forEach;
    DOMTokenList.prototype.forEach = DOMTokenList.prototype.forEach || Array.prototype.forEach;
    NamedNodeMap.prototype.forEach = NamedNodeMap.prototype.forEach || Array.prototype.forEach;

    var config = {
            prefixes      : ['data', 'directive'],
            allow_override: false
        },
        common_directive = {
            load        : function () {                                 //on load
            },
            ready       : function () {                                //on images loaded. to be implemented
            },
            alter       : function () {                                //on attributes change. to be implemented
            },
            unload      : function () {                               //on unload
            },
            template    : undefined,                                //template
            template_url: undefined,                                //template
            replace     : false                                      //replace content with template or append
        },
        directives = {},
        observer = new MutationObserver(observer_function);

    if (document.body) {
        observer.observe(document.body, {
            attributes: true,
            childList : true,
            subtree   : true
        })
    } else {
        (function (callback) {
            document.addEventListener && document.addEventListener("DOMContentLoaded", callback, false)
            //todo: think. not sure if i really need ie7- document load model while not supporting it in XNRrequest
            document.attachEvent && document.attachEvent("onreadystatechange", callback)
        })(function () {
            //emulating mutationObserver call with whole body after it's ready. It's quite better and gives browser a chance to load faster and not disturb on callback loop.
            observer_function([
                {
                    addedNodes  : [document.body],
                    removedNodes: [],
                    target      : document.body
                }
            ]);

            observer.observe(document.body, {
                attributes: true,
                childList : true,
                subtree   : true
            })
        })
    }

    directive_processor.config = config;
    return directive_processor;

    function directive_processor(directive_name, directive_body) {
        if ((typeof directive_name === "string") && ((["object", "function"]).indexOf(typeof directive_body) !== -1)) {
            if (!directives[directive_name] || config.allow_override) {
                create_directive(directive_name, directive_body)
            } else {
                throw 'trying to register already registred directive ' + directive_name
            }
        } else {
            throw 'incorrect directive call format'
        }
    }

    function create_directive(name, directive) {
        name = name.toLowerCase();
        function complete_from_common(element, common_element) {
            for (var directive_item in common_element) {
                element[directive_item] = element[directive_item] || common_element[directive_item]
            }
            return element
        }

        if (typeof directive === typeof function () {}) {directive = {load: directive}}

        directive = complete_from_common(directive, common_directive);
        directive.name = name;
        directives[name] = directive;
        return directive
    }

    function observer_function(mutationRecords) {
        mutationRecords.forEach(
            function process_mutation_record(mutationRecord) {
                for (var directive_name in directives) {
                    switch (mutationRecord.type) {
                        case "attributes":
                            var target = mutationRecord.target,
                                attribute_name = mutationRecord.attributeName,
                                attribute_directive = attribute_name;
                            config.prefixes.forEach(function (prefix) {
                                attribute_directive = attribute_directive.replace(prefix + '-', '');
                            });
                            if (attribute_directive == directive_name) {
                                var attribute = target.attributes.getNamedItem(attribute_name);
                                directives[directive_name].alter.call(target, attribute ? attribute.value : void 0);
                            }
                            break;
                        default:
                            mutationRecord.addedNodes.forEach(function (node) {
                                apply_directive_in_subtree(directive_name, 'load', node)
                            });
                            mutationRecord.removedNodes.forEach(function (node) {
                                apply_directive_in_subtree(directive_name, 'unload', node)
                            });
                    }
                }
            }
        )
    }

    function apply_directive_in_subtree(directive_name, action, node) {
        //child directives should be initialised earlier then parent ones
        if (node.children && node.children.forEach) {
            node.children.forEach(function (child) {apply_directive_in_subtree(directive_name, action, child)})
        }
        var has_directive = false;
        var attribute_value;
        var aliases = [directive_name];
        config.prefixes.forEach(function (prefix) {
            aliases.push(prefix + '-' + directive_name)
        });

        aliases.forEach(function (name) {
            if (node.classList && node.classList.forEach || node.className) {
                (node.classList || (node.className && node.className.split(' '))).forEach(function (class_name) {
                    if (class_name.toLowerCase() === name) {has_directive = true}
                })
            }

            if (node.attributes && node.attributes.forEach) { // check if node is not a text node
                node.attributes.forEach(function (attribute) {
                    if (attribute.name !== 'class' && attribute.name !== 'href') { //todo убрать, повесить основные элементы, вынести в конфиг
                        if (attribute.name.toLowerCase() === name) {
                            has_directive = true;
                            attribute_value = attribute.textContent;
                        }
                    }
                })
            }
        });
        if (has_directive) {
            var attribute;
            if (attribute_value) {
                try {
                    attribute = eval('({' + attribute_value + '})');
                } catch (exception) {
                    try {
                        attribute = eval(attribute_value)
                    } catch (exception) {
                        attribute = attribute_value;
                    }
                }
            }

            (function do_directive_action_call(name, action, node, attribute) {
                switch (action) {
                    case 'load':
                    function setContent(element, content, replace) {
                        if (replace) {
                            element.innerHTML = content
                        } else {
                            element.insertAdjacentHTML('beforeend', content)
                        }
                    }

                        if (directives[name].template_url) {
                            (function (xmlhttp) {
                                xmlhttp.onreadystatechange = function () {
                                    if (xmlhttp.readyState == 4) {
                                        if (xmlhttp.status == 200) {
                                            setContent(node, xmlhttp.responseText, directives[name].replace);
                                            directives[name][action].call(node, attribute);
                                        } else {
                                            throw directives[name].template_url + ' is not reachable. Cancelling "' + name + '" directive call'
                                        }
                                    }
                                };
                                xmlhttp.open("GET", directives[name].template_url, true);
                                xmlhttp.send();
                            })(new XMLHttpRequest());

                        } else {
                            if (directives[name].template) {
                                setContent(node, directives[name].template, directives[name].replace);
                            }
                            directives[name][action].call(node, attribute);
                        }
                        break;
                    case 'unload':
                        directives[name][action].call(node, attribute);
                        break;
                }
            })(directive_name, action, node, attribute)
        }
    }
})();