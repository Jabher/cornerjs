window.directive = (function () {
    //validations and preparations section. Expand only
    check_if_exist(window.XMLHttpRequest, 'XMLHttpRequest not found');
    check_if_exist(window.MutationObserver, 'MutationObserver (or polyfill) not found');
    check_if_exist(Array.prototype.indexOf, Array.prototype.forEach, Array.prototype.filter, 'MutationObserver (or polyfill) not found');

    //configuration section. Free to modify
    var config = directive_processor.config = {
        prefixes            : ['data', 'directive'],
        allow_override      : false,
        allow_after_DOMReady: true,
        ignored_attributes  : ['class', 'href']
    };
    var common_directive = {
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
    };
    var directives = directive_processor.directives = {};
    var observer = new MutationObserver(observer_function);

    //DO-NOT-TOUCH section. Only bug fixes and extensions are possible
    function shoot_observer() {
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
    }

    if (document.readyState == 'complete') {
        shoot_observer()
    } else {
        if (document.addEventListener) {
            document.addEventListener("DOMContentLoaded", shoot_observer, false)
        } else {
            document.attachEvent('DOMContentLoaded', shoot_observer)
        }
    }

    function directive_processor(directive_name, directive_body) {
        if (!config.allow_after_DOMReady && document.readyState == 'complete') {
            console.error('trying to register directive ' + directive_name + ' after DOM loaded; current config prohibits this action')
        } else if (check_if_valid(
            typeof directive_name === "string",
            (directive_body instanceof Object) || (directive_body instanceof Function),
            'incorrect directive call format')
            ) {
            directive_name = directive_name.toLowerCase();
            if (!directives[directive_name] || config.allow_override) {
                return create_directive(directive_name, directive_body)
            } else {
                console.error('trying to register already registered directive ' + directive_name)
            }
        }
        return false
    }

    return directive_processor;

    function create_directive(name, directive) {
        if (directive instanceof Function) {directive = {load: directive}}
        for (var directive_item in common_directive) {
            directive[directive_item] = directive[directive_item] || directive[directive_item]
        }
        directive.name = name;
        directive.aliases = [name];
        config.prefixes.forEach(function (prefix) {
            directive.aliases.push(prefix + '-' + name)
        });
        directives[name] = directive;
        if (document.readyState == 'complete') {
            Array.prototype.forEach.call(
                    document.querySelectorAll(directive.aliases.map(function (alias) {return ('.alias, [alias]').split('alias').join(alias)}).join(', ')),
                    node_loaded
            )
        }
        return directive
    }

    function observer_function(mutationRecords) {
        mutationRecords.forEach(
            function process_mutation_record(mutationRecord) {
                switch (mutationRecord.type) {
                    case "attributes":
                        node_altered(mutationRecord.target, mutationRecord)
                        break;
                    default:
                        Array.prototype.forEach.call(mutationRecord.addedNodes, function (node) {
                            apply_directives_in_subtree('load', node)
                        });
                        Array.prototype.forEach.call(mutationRecord.removedNodes, function (node) {
                            apply_directives_in_subtree('unload', node)
                        });
                }
            }
        )
    }

    function apply_directives_in_subtree(action, node) {
        //child directives should be initialised earlier then parent ones
        if (node.children) {
            Array.prototype.forEach.call(node.children, function (child) {apply_directives_in_subtree(action, child)})
        }

        switch (action) {
            case 'load':
                node_loaded(node);
                break;
            case 'unload':
                node_unloaded(node);
                break;
        }
    }

    //events processor section. New processors should be added here
    function node_loaded(node) {
        node.directives = detect_directives_for_node(node);
        generate_attribute_directive_aliases(node);

        for (var directive_name in node.directives) {
            if (node[directive_name]) continue;
            generate_directive_scope(node, node.directives[directive_name].directive);

            var node_directive = node.directives[directive_name],
                directive = node_directive.directive,
                caller = (function (node_directive, directive) {
                    return function (content) {
                        var attribute = node_directive.attribute ? smart_eval(node_directive.attribute.value) : undefined;
                        if (content) {set_node_content(node, content, directive.replace)}
                        if (directive.load) {
                            directive.load.call(node[directive.name], node, attribute);
                        }
                    }
                })(node_directive, directive);

            if (directive.template_url) {
                $ajax.get(directive.template_url, caller)
            } else {
                caller(directive.template)
            }
        }
    }

    function node_unloaded(node) {
        if (node.directives) {
            for (var directive_name in node.directives) {
                if (directives[directive_name].unload) {
                    directives[directive_name].unload.call(node[directive_name], node);
                }
            }
        }
    }

    function node_altered(node, mutationRecord) {
        if (node.directive_aliases) {
            var node_directive_scope = node.directive_aliases[mutationRecord.attributeName];
            if (node_directive_scope && node_directive_scope.attribute) {
                var attribute = node.attributes.getNamedItem(mutationRecord.attributeName).value;
                if (node_directive_scope.attribute.value !== attribute) {
                    node_directive_scope.attribute.value = attribute;
                    if (node_directive_scope.directive.alter) {
                        node_directive_scope.directive.alter.call(node_directive_scope, node, smart_eval(attribute))
                    }
                }
            }
        }
    }

    //event processor helpers section. Helper functions should be placed here
    function generate_attribute_directive_aliases(node) {
        node.directive_aliases = {};
        for (var directive_name in node.directives) {
            if (node.directives[directive_name].attribute) {
                node.directive_aliases[node.directives[directive_name].attribute.name] = node.directives[directive_name]
            }
        }
    }

    function generate_directive_scope(node, directive) {
        node[directive.name] = {
            directive: directive,
            node     : node
        }
    }

    function resolve_directives_in_classes(node) {
        var class_directives_list = [];
        if (node.classList || node.className) {
            node.classList = node.classList || node.className.split(' ') || [];
            Array.prototype.forEach.call(node.classList, function (class_name) {
                class_name = class_name.toLowerCase();
                for (var directive_name in directives) {
                    var directive = directives[directive_name];
                    directive.aliases.forEach(function (alias) {
                        if (class_name == alias) {
                            class_directives_list.push({
                                directive: directive,
                                'class'  : class_name
                            })
                        }
                    })
                }
            });
        }
        return class_directives_list
    }

    function resolve_directives_in_attributes(node) {
        var attribute_directives_list = [];
        if (node.attributes) { // check if node is not a text node
            Array.prototype.forEach.call(node.attributes, function (attribute) {
                if (config.ignored_attributes.indexOf(attribute.name) == -1) {
                    var attribute_name = attribute.name.toLowerCase();
                    for (var directive_name in directives) {
                        var directive = directives[directive_name];
                        directive.aliases.forEach(function (alias) {
                            if (attribute_name == alias) {
                                var attribute_value = attribute.textContent,
                                    parsed_value;
                                if (attribute_value) {
                                    try {
                                        parsed_value = eval('({' + attribute_value + '})');
                                    } catch (exception) {
                                        try {
                                            parsed_value = eval(attribute_value)
                                        } catch (exception) {
                                            parsed_value = attribute_value;
                                        }
                                    }
                                }
                                attribute_directives_list.push({
                                    directive: directive,
                                    attribute: {
                                        name        : attribute_name,
                                        value       : attribute_value,
                                        parsed_value: parsed_value
                                    }
                                })
                            }
                        })
                    }
                }
            })
        }
        return attribute_directives_list
    }

    function detect_directives_for_node(node) {
        var directives_list = {};
        resolve_directives_in_classes(node).forEach(function (class_directive_instance) {
            directives_list[class_directive_instance.directive.name] = class_directive_instance
        });
        resolve_directives_in_attributes(node).forEach(function (attr_directive_instance) {
            directives_list[attr_directive_instance.directive.name] = attr_directive_instance
        });
        return directives_list
    }
})();