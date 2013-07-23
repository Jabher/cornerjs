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
                    node.addEventListener('DOMAttrModified', this, true);

                if (options.characterData)
                    node.addEventListener('DOMCharacterDataModified', this, true);

                if (options.childList)
                    node.addEventListener('DOMNodeInserted', this, true);

                if (options.childList || options.subtree)
                    node.addEventListener('DOMNodeRemoved', this, true);
            },

            removeListeners: function () {
                this.removeListeners_(this.target);
            },

            removeListeners_: function (node) {
                var options = this.options;
                if (options.attributes)
                    node.removeEventListener('DOMAttrModified', this, true);

                if (options.characterData)
                    node.removeEventListener('DOMCharacterDataModified', this, true);

                if (options.childList)
                    node.removeEventListener('DOMNodeInserted', this, true);

                if (options.childList || options.subtree)
                    node.removeEventListener('DOMNodeRemoved', this, true);
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
                    case 'DOMAttrModified':
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

                    case 'DOMCharacterDataModified':
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

                    case 'DOMNodeRemoved':
                        this.addTransientObserver(e.target);
                    // Fall through.
                    case 'DOMNodeInserted':
                        // http://dom.spec.whatwg.org/#concept-mo-queue-childlist
                        var target = e.relatedNode;
                        var changedNode = e.target;
                        var addedNodes, removedNodes;
                        if (e.type === 'DOMNodeInserted') {
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
    })();;(function() {
  var __hasProp = {}.hasOwnProperty;

  Array.prototype.flatten = function() {
    var a, element, _i, _len;
    a = [];
    for (_i = 0, _len = this.length; _i < _len; _i++) {
      element = this[_i];
      if (element != null) {
        a = a.concat(element.flatten ? element.flatten() : element);
      }
    }
    return a;
  };

  Object.prototype["do"] = function(processor) {
    return processor(this);
  };

  window.directive = (function() {
    var apply_directives_in_subtree, config, create_directive, directive_processor, directives, node_altered, node_loaded, node_unloaded, observer, observer_function, parse_node_attrs, put_in_queue, resolve_directives_in_attributes, resolve_directives_in_classes, resolve_directives_in_tag, shoot_observer, smart_eval;
    config = {
      prefixes: ["data-", "directive-", ""],
      ignored_attributes: ["class", "href"]
    };
    smart_eval = function(content) {
      var output;
      output = content;
      if (typeof output === 'string') {
        try {
          output = eval(content);
        } catch (_error) {}
        try {
          output = eval("({" + content + "})");
        } catch (_error) {}
      }
      return output;
    };
    put_in_queue = function(func) {
      return setTimeout(func, 0);
    };
    apply_directives_in_subtree = function(action, node) {
      var child, _i, _len, _ref;
      if (node.children) {
        _ref = node.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          apply_directives_in_subtree(action, child);
        }
      }
      switch (action) {
        case "load":
          return node_loaded(node);
        case "unload":
          return node_unloaded(node);
      }
    };
    parse_node_attrs = function(node) {
      var attrHash, attribute, _i, _len, _ref;
      attrHash = {};
      if (node.attributes) {
        _ref = node.attributes;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          attribute = _ref[_i];
          attrHash[attribute.name] = smart_eval(attribute.value);
        }
      }
      return attrHash;
    };
    resolve_directives_in_classes = function(node) {
      var class_name, directive, directive_name, prefix, _i, _len, _ref, _results;
      _ref = node.classList || (node.className && node.className.split(" ")) || [];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        class_name = _ref[_i];
        _results.push((function() {
          var _results1;
          _results1 = [];
          for (directive_name in directives) {
            if (!__hasProp.call(directives, directive_name)) continue;
            directive = directives[directive_name];
            _results1.push((function() {
              var _j, _len1, _ref1, _results2;
              _ref1 = config.prefixes;
              _results2 = [];
              for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                prefix = _ref1[_j];
                if (class_name.toLowerCase() === (prefix + directive_name)) {
                  _results2.push({
                    directive: directive,
                    type: 'class'
                  });
                }
              }
              return _results2;
            })());
          }
          return _results1;
        })());
      }
      return _results;
    };
    resolve_directives_in_attributes = function(node) {
      var attribute, directive, directive_name, prefix, _i, _len, _ref, _results;
      _ref = node.attributes || [];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attribute = _ref[_i];
        if (config.ignored_attributes.indexOf(attribute.name) === -1) {
          _results.push((function() {
            var _results1;
            _results1 = [];
            for (directive_name in directives) {
              if (!__hasProp.call(directives, directive_name)) continue;
              directive = directives[directive_name];
              _results1.push((function() {
                var _j, _len1, _ref1, _results2;
                _ref1 = config.prefixes;
                _results2 = [];
                for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                  prefix = _ref1[_j];
                  if (attribute.name.toLowerCase() === (prefix + directive_name)) {
                    _results2.push({
                      directive: directive,
                      attribute_name: attribute.name.toLowerCase(),
                      attribute: attribute.value,
                      type: 'attribute'
                    });
                  }
                }
                return _results2;
              })());
            }
            return _results1;
          })());
        }
      }
      return _results;
    };
    resolve_directives_in_tag = function(node) {
      var directive, directive_name, prefix, _results;
      if (node.tagName == null) {
        return [];
      }
      _results = [];
      for (directive_name in directives) {
        if (!__hasProp.call(directives, directive_name)) continue;
        directive = directives[directive_name];
        _results.push((function() {
          var _i, _len, _ref, _results1;
          _ref = config.prefixes;
          _results1 = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            prefix = _ref[_i];
            if (node.tagName.toLowerCase() === (prefix + directive_name)) {
              _results1.push({
                directive: directive,
                type: 'tag',
                attribute_name: node.tagName,
                attribute: parse_node_attrs(node)
              });
            }
          }
          return _results1;
        })());
      }
      return _results;
    };
    node_loaded = function(node) {
      var directive, directive_name, instance, instances, node_directive, _i, _len, _ref, _results;
      node.directives || (node.directives = {});
      node.directive_aliases || (node.directive_aliases = {});
      instances = [].concat(resolve_directives_in_classes(node)).concat(resolve_directives_in_attributes(node)).concat(resolve_directives_in_tag(node)).flatten();
      for (_i = 0, _len = instances.length; _i < _len; _i++) {
        instance = instances[_i];
        node.directives[instance.directive.name] = instance;
        if (instance.attribute_name) {
          node.directive_aliases[instance.attribute_name] = instance;
        }
      }
      _ref = node.directives;
      _results = [];
      for (directive_name in _ref) {
        node_directive = _ref[directive_name];
        if (!(node[directive_name] == null)) {
          continue;
        }
        node[directive_name] = {
          directive: node_directive,
          node: node
        };
        directive = node_directive.directive;
        if (directive.load) {
          _results.push(put_in_queue(directive.load.bind(node[directive.name], node, smart_eval(node_directive.attribute))));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };
    node_unloaded = function(node) {
      var directive_name, node_directive, _ref, _results;
      if (node.directives) {
        _ref = node.directives;
        _results = [];
        for (directive_name in _ref) {
          node_directive = _ref[directive_name];
          if ((node_directive != null) && (directives[directive_name].unload != null)) {
            _results.push(put_in_queue(directives[directive_name].unload.bind(node[directive_name], node, smart_eval(node_directive.attribute))));
          }
        }
        return _results;
      }
    };
    node_altered = function(node, mutationRecord) {
      var node_directive_scope;
      if (node.directive_aliases) {
        if (node.directives[node.tagName.toLowerCase()]) {
          put_in_queue(node_directive_scope.directive.alter.bind(node_directive_scope, node, parse_node_attrs(node)));
        }
        node_directive_scope = node.directive_aliases[mutationRecord.attributeName];
        if (node_directive_scope && node_directive_scope.attribute && node_directive_scope.directive.alter) {
          return put_in_queue(node_directive_scope.directive.alter.bind(node_directive_scope, node, smart_eval(node.attributes.getNamedItem(mutationRecord.attributeName).value)));
        }
      }
    };
    create_directive = function(name, directive) {
      if (directive instanceof Function) {
        directive = {
          load: directive
        };
      }
      if (directive.load == null) {
        directive.load = directive.alter;
      }
      directive.name = name.toLowerCase();
      directives[directive.name] = directive;
      if (document.readyState === "complete") {
        return node_loaded(document.body);
      }
    };
    observer_function = function(mutationRecords) {
      return Array.prototype.forEach.call(mutationRecords, function(mutationRecord) {
        var addedNode, removedNode, _i, _j, _len, _len1, _ref, _ref1, _results;
        switch (mutationRecord.type) {
          case "attributes":
            return node_altered(mutationRecord.target, mutationRecord);
          default:
            _ref = mutationRecord.addedNodes;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              addedNode = _ref[_i];
              apply_directives_in_subtree("load", addedNode);
            }
            _ref1 = mutationRecord.removedNodes;
            _results = [];
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              removedNode = _ref1[_j];
              _results.push(apply_directives_in_subtree("unload", removedNode));
            }
            return _results;
        }
      });
    };
    directives = {};
    observer = new MutationObserver(observer_function);
    directive_processor = function(directive_name, directive_body) {
      if ((directive_name.constructor !== String) || (!((directive_body instanceof Object) || (directive_body instanceof Function)))) {
        throw new TypeError("incorrect directive format");
      }
      if (directives[directive_name.toLowerCase()]) {
        throw "trying to register already registered directive " + directive_name;
      }
      return create_directive(directive_name, directive_body);
    };
    shoot_observer = function() {
      observer_function([
        {
          addedNodes: [document.body],
          removedNodes: [],
          target: document.body
        }
      ]);
      return observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true
      });
    };
    if (document.readyState === "complete") {
      shoot_observer();
    } else {
      document.addEventListener("DOMContentLoaded", shoot_observer, false);
    }
    return directive_processor;
  })();

}).call(this);
