/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 */

// SideTable is a weak map where possible. If WeakMap is not available the
// association is stored as an expando property.


(function () {
    var counter = new Date().getTime() % 1e9;

    window.SideTable = function () {
        this.name = '__st' + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
    };

    window.SideTable.prototype = {
        'set': function (key, value) {
            Object.defineProperty(key, this.name, {value: value, writable: true});
        },
        'get': function (key) {
            return Object.hasOwnProperty.call(key, this.name) ? key[this.name] : undefined;
        },
        'delete': function (key) {
            this.set(key, undefined);
        }
    }
})();;/*
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
    })();;window['directive'] = (function () {
    "use strict";
    var ignoredAttributes = ['id', 'href', 'style', 'class', 'src'];
    var prefixList = ['data-', 'directive-', ''];
    var directiveAliasList = {};
    var directives = {};

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
    function execute(fun){
        try {
            fun()
        } catch (e) {
            setTimeout(function(){
               throw e
            });
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

    function directiveLoadedAction(node, directive, attributeValue) {
        var directiveScopeName = getScopeName(directive);
        if (!node[directiveScopeName]) {
            var scope = node[directiveScopeName] = {};
            if (directive.onLoad) {
                execute(function(){
                    directive.onLoad.call(scope, node, attributeValue)
                });
            }
        }
    }

    function directiveAlteredAction(node, directive, attributeValue) {
        var directiveScopeName = getScopeName(directive);
        if (node[directiveScopeName]) {
            if (directive.onAlter) {
                execute(function(){
                    directive.onAlter.call(node[directiveScopeName], node, attributeValue)
                });
            }
        }
    }

    function directiveRemovedAction(node, directive, attributeValue) {
        var directiveScopeName = getScopeName(directive);
        if (node[directiveScopeName]) {
            if (directive.onUnload) {
                execute(function(){
                    directive.onUnload.call(node[directiveScopeName], node, attributeValue);
                });
            }
            node[directiveScopeName] = void 0
        }
    }

    function classAdded(node, className) {
        var directive = directiveAliasList[className.toLowerCase()];
        if (directive) {
            directiveLoadedAction(node, directive, undefined);
        }
    }

    function classRemoved(node, className) {
        var directive = directiveAliasList[className.toLowerCase()];
        if (directive) {
            directiveRemovedAction(node, directive, undefined);
        }
    }

    function attributeAdded(node, attributeName) {
        var directive = directiveAliasList[attributeName.toLowerCase()];
        if (directive) {
            directiveLoadedAction(node, directive, smartEval(node.attributes[attributeName].value));
        }
    }

    function attributeRemoved(node, attributeName) {
        var directive = directiveAliasList[attributeName.toLowerCase()];
        if (directive) {
            directiveRemovedAction(node, directive, undefined);
        }
    }

    function attributeChanged(node, attributeName) {
        var directive = directiveAliasList[attributeName.toLowerCase()];
        if (directive) {
            directiveAlteredAction(node, directive, smartEval(node.attributes[attributeName].value));
        }
    }

    function nodeAdded(node) {
        var directive = directiveAliasList[ node.tagName.toLowerCase() ];
        if (directive) {
            node.addEventListener('attributeChanged', function () {
                directiveAlteredAction(node, directive, getAttributesObject(node))
            });
            directiveLoadedAction(node, directive, getAttributesObject(node))
        }
    }

    function nodeRemoved(node) {
        var directive = directiveAliasList[ node.tagName.toLowerCase() ];
        if (directive) {
            directiveLoadedAction(node, directive, getAttributesObject(node))
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
        (new MutationObserver(function (mutationRecordList) {
            for (var i = 0; i < mutationRecordList.length; i++) {
                mutationRecordProcessor(mutationRecordList[i]);
            }
        })).observe(document.body, {
                childList: true,
                attributes: true,
                subtree: true,
                attributeOldValue: true
            });
        nodeListAdded([document.body]);
        oberverLaunched = true;
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
        if (options.toString() !== "[object Object]") {
            throw new TypeError('Directive config should be an common object')
        }
        var directive = {
                name: name,
                onLoad: options.load || options.alter,
                onUnload: options.unload,
                onAlter: options.alter
            },
            aliases = prefixList.map(function (p) {
                return p + name
            });
        aliases.forEach(function (alias) {
            directiveAliasList[alias] = directive;
        });
        directives[name] = directive;
        if (oberverLaunched) {
            aliases.forEach(function (className) {
                var nodes = document.body.querySelectorAll('.' + className) || [];
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    classAdded(node, className)
                }
            });
            aliases.forEach(function (attrName) {
                var nodes = document.body.querySelectorAll('[' + attrName + ']') || [];
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    attributeAdded(node, attrName)
                }
            });
            aliases.forEach(function (tagName) {
                var nodes = document.body.querySelectorAll(tagName) || [];
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    nodeAdded(node)
                }
            });
        }
        return name
    }).bind(this);
}).call(window);