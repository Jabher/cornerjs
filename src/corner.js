(function (global) {
    var directive_map = {},
        directive_list = [],
        key = '__directives__';

    function itar(iterable, callback) {
        if (iterable && iterable.length)
            Array.prototype.forEach.call(iterable, callback);
    }

    function wrap_cb(cb){
        if (cb) {
            return function(){
                try {
                    cb.apply(this, arguments);
                } catch (e) {
                    console.error(e, {arguments: arguments});
                    setTimeout(function(){
                        throw e;
                    },0);
                }
            }
        }
    }

    function directive(originalName, opts) {
        var name = originalName.toLowerCase();
        if (name in directive_map) throw new Error('directive already registered');
        if (opts instanceof Function) opts = {load: opts};
        directive_list.push(directive_map[name] = {name: name, originalName: originalName, onload: wrap_cb(opts.load || opts.alter), onunload: wrap_cb(opts.unload), onalter: wrap_cb(opts.alter)});
        if (document.body) itar(document.body.querySelectorAll([name, ', [', name, '], .', name].join('')), element_loaded);
    }

    function eval_attribute(element, attributeName) {
        if (!attributeName) {
            var attrs = {};
            itar(element.attributes, function (attribute) {
                attrs[attribute.name] = eval_attribute(element, attribute.name);
            });
            return attrs;
        } else {
            var attribute = element.attributes[attributeName];
            try {
                return eval('({' + attribute.value + '})')
            } catch (e) {
                try {
                    return eval('(' + attribute.value + ')')
                } catch (e) {
                    return attribute && attribute.value;
                }
            }
        }
    }


    function corner_init() {
        element_loaded(document.body);
        new MutationObserver(function (mutationEventList) {
            itar(mutationEventList, function (mutationEvent) {
                switch (mutationEvent.type) {
                    case 'childList':
                        itar(mutationEvent.addedNodes, element_loaded_wrapper);
                        itar(mutationEvent.removedNodes, element_removed_wrapper);
                        break;
                    case 'attributes':
                        var target = mutationEvent.target;

                        if (mutationEvent.attributeName === 'class') {
                            var oldClassList = (mutationEvent.oldValue || '').toLowerCase().split(' '),
                                newClassList = (target.className || '').toLowerCase().split(' ');

                            itar(oldClassList.filter(function (entry) {return newClassList.indexOf(entry) === -1}), function (name) {
                                if (directive_map[name]) directive_removed(directive_map[name], target);
                            });
                            itar(newClassList.filter(function (entry) {return oldClassList.indexOf(entry) === -1}), function (name) {
                                if (directive_map[name]) directive_loaded(directive_map[name], target, 'class');
                            });

                        }
                        else if (directive_map[mutationEvent.attributeName]) {
                            var directive = directive_map[mutationEvent.attributeName];

                            if (target.attributes[mutationEvent.attributeName])
                                if (mutationEvent.oldValue !== null)
                                    directive_altered(directive, target, 'attribute');
                                else
                                    directive_loaded(directive, target, 'attribute');
                            else
                                directive_removed(directive, target);
                        }


                        if (target[key] && target[key]['$'])
                            directive_altered(target[key]['$'].directive, target, 'tag');

                        break;
                }
            });
        }).observe(document.body, {
                childList        : true,
                subtree          : true,
                attributes        : true,
                attributeOldValue: true
            });
    }


    document.addEventListener('DOMContentLoaded', corner_init);
    if (document.readyState !== 'loading') corner_init();

    function element_loaded_wrapper(element) {
        element_loaded(element);
        itar(element.children, element_loaded_wrapper);
    }

    function element_loaded(element) {
        if (!element.tagName) return;
        var topParent = element.parentElement;
        while (topParent.parentElement) topParent = topParent.parentElement;
        if (topParent !== document.documentElement) return;
        var element_tag_directives = [],
            element_class_directives = [],
            element_attribute_directives = [],
            element_class_list = (element.className || '').toLowerCase().split(' ');
        directive_list.forEach(function (directive) {
            if (element.tagName.toLowerCase() === directive.name)
                element_tag_directives.push(directive);

            if (directive.name in element.attributes)
                element_attribute_directives.push(directive);

            if (element_class_list.indexOf(directive.name) !== -1)
                element_class_directives.push(directive);
        });

        function directive_loaded_caller(type) {
            return function (directive) {
                directive_loaded(directive, element, type)
            }
        }

        if (element_tag_directives.length + element_class_directives.length + element_attribute_directives.length) {
            element_tag_directives.forEach(directive_loaded_caller('tag'));
            element_attribute_directives.forEach(directive_loaded_caller('attribute'));
            element_class_directives.forEach(directive_loaded_caller('class'));
        }
    }

    function register_directive(directive, element, recordType) {
        var entry = element[key][directive.name];
        if (!entry)
            entry = element[key][directive.name] = {
                type     : recordType,
                directive: directive,
                scope    : {}
            };

        if (recordType === 'tag')
            entry.argument = eval_attribute(element);
        else if (recordType === 'attribute')
            entry.argument = eval_attribute(element, directive.name);

        if (recordType === 'tag') Object.defineProperty(element[key], '$', {value: entry});
        return entry;
    }

    function directive_loaded(directive, element, recordType) {
        if (!element[key]) Object.defineProperty(element, key, { value: {} });
        if (element[key][directive.name]) return;

        var element_directive = register_directive(directive, element, recordType);

        if (directive.onload)
            directive.onload.call(element_directive.scope, element, element_directive.argument);
    }

    function directive_altered(directive, element, recordType) {
        if (directive.onalter) {
            var element_directive = register_directive(directive, element, recordType);
            directive.onalter.call(element_directive.scope, element, element_directive.argument);
        }
    }

    function element_removed_wrapper(element) {
        itar(element.children, element_removed_wrapper);
        element_removed(element);
    }

    function element_removed(element) {
        if (!element[key]) return;
        Object.keys(element[key]).forEach(function (directiveName) {
            var directive = directive_map[directiveName];
            var element_directive = register_directive(directive, element);
            if (directive.onunload)
                directive.onunload.call(element_directive.scope, element, element_directive.argument);
        });
    }

    function directive_removed(directive, element) {
        var element_directive = register_directive(directive, element);
        if (element[key] && element[key][directive.name]) {
            if (directive.onunload)
                directive.onunload.call(element_directive.scope, element, element_directive.argument);
            delete element[key][directive.name];
        }
    }

    if ('module' in global) {
        global.module.exports = directive;
    } else if ('exports' in global) {
        global.exports = directive;
    } else {
        global.directive = directive;
    }
})((0, eval)('this'));
