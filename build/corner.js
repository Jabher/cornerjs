/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 */


window.MutationObserver = window.MutationObserver ||
    window.WebKitMutationObserver ||
    (function () {
        var DOMAttrModified = 'DOMAttrModified',
            DOMCharacterDataModified = 'DOMCharacterDataModified',
            DOMNodeInserted = 'DOMNodeInserted',
            DOMNodeRemoved = 'DOMNodeRemoved';

        var registrationsTable = new SideTable();

        // We use setImmediate or postMessage for our future callback.
        var setImmediate = window.SetImmediate || window.msSetImmediate;

        // Use post message to emulate setImmediate.
        if (!setImmediate) {
            var setImmediateQueue = [];
            var sentinel = String(Math.random());
            window.addEventListener('message', function (e) {
                if (e.data === sentinel) {
                    var queue = setImmediateQueue;
                    setImmediateQueue = [];
                    queue.forEach(function (func) {
                        func();
                    });
                }
            });
            setImmediate = function (func) {
                setImmediateQueue.push(func);
                window.postMessage(sentinel, '*');
            };
        }

        // This is used to ensure that we never schedule 2 callas to setImmediate
        var isScheduled = false;

        // Keep track of observers that needs to be notified next time.
        var scheduledObservers = [];

        /**
         * Schedules |dispatchCallback| to be called in the future.
         * @param {MutationObserver} observer
         */
        function scheduleCallback(observer) {
            scheduledObservers.push(observer);
            if (!isScheduled) {
                isScheduled = true;
                setImmediate(dispatchCallbacks);
            }
        }

        function wrapIfNeeded(node) {
            return window.ShadowDOMPolyfill &&
                window.ShadowDOMPolyfill.wrapIfNeeded(node) ||
                node;
        }

        function dispatchCallbacks() {
            // http://dom.spec.whatwg.org/#mutation-observers

            isScheduled = false; // Used to allow a new setImmediate call above.

            var observers = scheduledObservers;
            scheduledObservers = [];
            // Sort observers based on their creation UID (incremental).
            observers.sort(function (o1, o2) {
                return o1.uid_ - o2.uid_;
            });

            var anyNonEmpty = false;
            observers.forEach(function (observer) {

                // 2.1, 2.2
                var queue = observer.takeRecords();
                // 2.3. Remove all transient registered observers whose observer is mo.
                removeTransientObserversFor(observer);

                // 2.4
                if (queue.length) {
                    observer.callback_(queue, observer);
                    anyNonEmpty = true;
                }
            });

            // 3.
            if (anyNonEmpty)
                dispatchCallbacks();
        }

        function removeTransientObserversFor(observer) {
            observer.nodes_.forEach(function (node) {
                var registrations = registrationsTable.get(node);
                if (!registrations)
                    return;
                registrations.forEach(function (registration) {
                    if (registration.observer === observer)
                        registration.removeTransientObservers();
                });
            });
        }

        /**
         * This function is used for the "For each registered observer observer (with
         * observer's options as options) in target's list of registered observers,
         * run these substeps:" and the "For each ancestor ancestor of target, and for
         * each registered observer observer (with options options) in ancestor's list
         * of registered observers, run these substeps:" part of the algorithms. The
         * |options.subtree| is checked to ensure that the callback is called
         * correctly.
         *
         * @param {Node} target
         * @param {function(MutationObserverInit):MutationRecord} callback
         */
        function forEachAncestorAndObserverEnqueueRecord(target, callback) {
            for (var node = target; node; node = node.parentNode) {
                var registrations = registrationsTable.get(node);

                if (registrations) {
                    for (var j = 0; j < registrations.length; j++) {
                        var registration = registrations[j];
                        var options = registration.options;

                        // Only target ignores subtree.
                        if (node !== target && !options.subtree)
                            continue;

                        var record = callback(options);
                        if (record)
                            registration.enqueue(record);
                    }
                }
            }
        }

        var uidCounter = 0;

        /**
         * The class that maps to the DOM MutationObserver interface.
         * @param {Function} callback.
         * @constructor
         */
        function JsMutationObserver(callback) {
            this.callback_ = callback;
            this.nodes_ = [];
            this.records_ = [];
            this.uid_ = ++uidCounter;
        }

        JsMutationObserver.prototype = {
            observe: function (target, options) {
                if (target.jquery) {
                    target = target[0]
                }
                target = wrapIfNeeded(target);

                // 1.1
                if (!options.childList && !options.attributes && !options.characterData ||

                    // 1.2
                    options.attributeOldValue && !options.attributes ||

                    // 1.3
                    options.attributeFilter && options.attributeFilter.length && !options.attributes ||

                    // 1.4
                    options.characterDataOldValue && !options.characterData) {

                    throw new SyntaxError();
                }

                var registrations = registrationsTable.get(target);
                if (!registrations)
                    registrationsTable.set(target, registrations = []);

                // 2
                // If target's list of registered observers already includes a registered
                // observer associated with the context object, replace that registered
                // observer's options with options.
                var registration;
                for (var i = 0; i < registrations.length; i++) {
                    if (registrations[i].observer === this) {
                        registration = registrations[i];
                        registration.removeListeners();
                        registration.options = options;
                        break;
                    }
                }

                // 3.
                // Otherwise, add a new registered observer to target's list of registered
                // observers with the context object as the observer and options as the
                // options, and add target to context object's list of nodes on which it
                // is registered.
                if (!registration) {
                    registration = new Registration(this, target, options);
                    registrations.push(registration);
                    this.nodes_.push(target);
                }

                registration.addListeners();
            },

            disconnect: function () {
                this.nodes_.forEach(function (node) {
                    var registrations = registrationsTable.get(node);
                    for (var i = 0; i < registrations.length; i++) {
                        var registration = registrations[i];
                        if (registration.observer === this) {
                            registration.removeListeners();
                            registrations.splice(i, 1);
                            // Each node can only have one registered observer associated with
                            // this observer.
                            break;
                        }
                    }
                }, this);
                this.records_ = [];
            },

            takeRecords: function () {
                var copyOfRecords = this.records_;
                this.records_ = [];
                return copyOfRecords;
            }
        };

        /**
         * @param {string} type
         * @param {Node} target
         * @constructor
         */
        function MutationRecord(type, target) {
            this.type = type;
            this.target = target;
            this.addedNodes = [];
            this.removedNodes = [];
            this.previousSibling = null;
            this.nextSibling = null;
            this.attributeName = null;
            this.attributeNamespace = null;
            this.oldValue = null;
        }

        function copyMutationRecord(original) {
            var record = new MutationRecord(original.type, original.target);
            record.addedNodes = original.addedNodes.slice();
            record.removedNodes = original.removedNodes.slice();
            record.previousSibling = original.previousSibling;
            record.nextSibling = original.nextSibling;
            record.attributeName = original.attributeName;
            record.attributeNamespace = original.attributeNamespace;
            record.oldValue = original.oldValue;
            return record;
        };

        // We keep track of the two (possibly one) records used in a single mutation.
        var currentRecord, recordWithOldValue;

        /**
         * Creates a record without |oldValue| and caches it as |currentRecord| for
         * later use.
         * @param {string} oldValue
         * @return {MutationRecord}
         */
        function getRecord(type, target) {
            return currentRecord = new MutationRecord(type, target);
        }

        /**
         * Gets or creates a record with |oldValue| based in the |currentRecord|
         * @param {string} oldValue
         * @return {MutationRecord}
         */
        function getRecordWithOldValue(oldValue) {
            if (recordWithOldValue)
                return recordWithOldValue;
            recordWithOldValue = copyMutationRecord(currentRecord);
            recordWithOldValue.oldValue = oldValue;
            return recordWithOldValue;
        }

        function clearRecords() {
            currentRecord = recordWithOldValue = undefined;
        }

        /**
         * @param {MutationRecord} record
         * @return {boolean} Whether the record represents a record from the current
         * mutation event.
         */
        function recordRepresentsCurrentMutation(record) {
            return record === recordWithOldValue || record === currentRecord;
        }

        /**
         * Selects which record, if any, to replace the last record in the queue.
         * This returns |null| if no record should be replaced.
         *
         * @param {MutationRecord} lastRecord
         * @param {MutationRecord} newRecord
         * @param {MutationRecord}
         */
        function selectRecord(lastRecord, newRecord) {
            if (lastRecord === newRecord)
                return lastRecord;

            // Check if the the record we are adding represents the same record. If
            // so, we keep the one with the oldValue in it.
            if (recordWithOldValue && recordRepresentsCurrentMutation(lastRecord))
                return recordWithOldValue;

            return null;
        }

        /**
         * Class used to represent a registered observer.
         * @param {MutationObserver} observer
         * @param {Node} target
         * @param {MutationObserverInit} options
         * @constructor
         */
        function Registration(observer, target, options) {
            this.observer = observer;
            this.target = target;
            this.options = options;
            this.transientObservedNodes = [];
        }

        Registration.prototype = {
            enqueue: function (record) {
                var records = this.observer.records_;
                var length = records.length;

                // There are cases where we replace the last record with the new record.
                // For example if the record represents the same mutation we need to use
                // the one with the oldValue. If we get same record (this can happen as we
                // walk up the tree) we ignore the new record.
                if (records.length > 0) {
                    var lastRecord = records[length - 1];
                    var recordToReplaceLast = selectRecord(lastRecord, record);
                    if (recordToReplaceLast) {
                        records[length - 1] = recordToReplaceLast;
                        return;
                    }
                } else {
                    scheduleCallback(this.observer);
                }

                records[length] = record;
            },

            addListeners: function () {
                this.addListeners_(this.target);
            },

            addListeners_: function (node) {
                var options = this.options;
                if (options.attributes)
                    node.addEventListener(DOMAttrModified, this, true);

                if (options.characterData)
                    node.addEventListener(DOMCharacterDataModified, this, true);

                if (options.childList)
                    node.addEventListener(DOMNodeInserted, this, true);

                if (options.childList || options.subtree)
                    node.addEventListener(DOMNodeRemoved, this, true);
            },

            removeListeners: function () {
                this.removeListeners_(this.target);
            },

            removeListeners_: function (node) {
                var options = this.options;
                if (options.attributes)
                    node.removeEventListener(DOMAttrModified, this, true);

                if (options.characterData)
                    node.removeEventListener(DOMCharacterDataModified, this, true);

                if (options.childList)
                    node.removeEventListener(DOMNodeInserted, this, true);

                if (options.childList || options.subtree)
                    node.removeEventListener(DOMNodeRemoved, this, true);
            },

            /**
             * Adds a transient observer on node. The transient observer gets removed
             * next time we deliver the change records.
             * @param {Node} node
             */
            addTransientObserver: function (node) {
                // Don't add transient observers on the target itself. We already have all
                // the required listeners set up on the target.
                if (node === this.target)
                    return;

                this.addListeners_(node);
                this.transientObservedNodes.push(node);
                var registrations = registrationsTable.get(node);
                if (!registrations)
                    registrationsTable.set(node, registrations = []);

                // We know that registrations does not contain this because we already
                // checked if node === this.target.
                registrations.push(this);
            },

            removeTransientObservers: function () {
                var transientObservedNodes = this.transientObservedNodes;
                this.transientObservedNodes = [];

                transientObservedNodes.forEach(function (node) {
                    // Transient observers are never added to the target.
                    this.removeListeners_(node);

                    var registrations = registrationsTable.get(node);
                    for (var i = 0; i < registrations.length; i++) {
                        if (registrations[i] === this) {
                            registrations.splice(i, 1);
                            // Each node can only have one registered observer associated with
                            // this observer.
                            break;
                        }
                    }
                }, this);
            },

            handleEvent: function (e) {
                // Stop propagation since we are managing the propagation manually.
                // This means that other mutation events on the page will not work
                // correctly but that is by design.
                e.stopImmediatePropagation();

                switch (e.type) {
                    case DOMAttrModified:
                        // http://dom.spec.whatwg.org/#concept-mo-queue-attributes

                        var name = e.attrName;
                        var namespace = e.relatedNode.namespaceURI;
                        var target = e.target;

                        // 1.
                        var record = new getRecord('attributes', target);
                        record.attributeName = name;
                        record.attributeNamespace = namespace;

                        // 2.
                        var oldValue =
                            e.attrChange === MutationEvent.ADDITION ? null : e.prevValue;

                        forEachAncestorAndObserverEnqueueRecord(target, function (options) {
                            // 3.1, 4.2
                            if (!options.attributes)
                                return;

                            // 3.2, 4.3
                            if (options.attributeFilter && options.attributeFilter.length &&
                                options.attributeFilter.indexOf(name) === -1 &&
                                options.attributeFilter.indexOf(namespace) === -1) {
                                return;
                            }
                            // 3.3, 4.4
                            if (options.attributeOldValue)
                                return getRecordWithOldValue(oldValue);

                            // 3.4, 4.5
                            return record;
                        });

                        break;

                    case DOMCharacterDataModified:
                        // http://dom.spec.whatwg.org/#concept-mo-queue-characterdata
                        var target = e.target;

                        // 1.
                        var record = getRecord('characterData', target);

                        // 2.
                        var oldValue = e.prevValue;


                        forEachAncestorAndObserverEnqueueRecord(target, function (options) {
                            // 3.1, 4.2
                            if (!options.characterData)
                                return;

                            // 3.2, 4.3
                            if (options.characterDataOldValue)
                                return getRecordWithOldValue(oldValue);

                            // 3.3, 4.4
                            return record;
                        });

                        break;

                    case DOMNodeRemoved:
                        this.addTransientObserver(e.target);
                    // Fall through.
                    case DOMNodeInserted:
                        // http://dom.spec.whatwg.org/#concept-mo-queue-childlist
                        var target = e.relatedNode;
                        var changedNode = e.target;
                        var addedNodes, removedNodes;
                        if (e.type === DOMNodeInserted) {
                            addedNodes = [changedNode];
                            removedNodes = [];
                        } else {

                            addedNodes = [];
                            removedNodes = [changedNode];
                        }
                        var previousSibling = changedNode.previousSibling;
                        var nextSibling = changedNode.nextSibling;

                        // 1.
                        var record = getRecord('childList', target);
                        record.addedNodes = addedNodes;
                        record.removedNodes = removedNodes;
                        record.previousSibling = previousSibling;
                        record.nextSibling = nextSibling;

                        forEachAncestorAndObserverEnqueueRecord(target, function (options) {
                            // 2.1, 3.2
                            if (!options.childList)
                                return;

                            // 2.2, 3.3
                            return record;
                        });

                }

                clearRecords();
            }
        };

        return JsMutationObserver;
    })();;(function (global) {
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
                attribute        : true,
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
        if (!element || !element.tagName) return;
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
