if (typeof window.addEventListener === 'undefined'){
    window.addEventListener = window.attachEvent
}

/*
 * Polyfills from:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach.
 * https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/filter
 * https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/filter
 *
 * Required for IE8-
 * */
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement /*, fromIndex */) {
        "use strict";
        if (this === null) {
            throw new TypeError();
        }
        var t = Object(this);
        var len = t.length >>> 0;
        if (len === 0) {
            return -1;
        }
        var n = 0;
        if (arguments.length > 1) {
            n = Number(arguments[1]);
            if (n != n) { // shortcut for verifying if it's NaN
                n = 0;
            } else if (n !== 0 && n !== Infinity && n !== -Infinity) {
                n = (n > 0 || -1) * Math.floor(Math.abs(n));
            }
        }
        if (n >= len) {
            return -1;
        }
        var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
        for (; k < len; k++) {
            if (k in t && t[k] === searchElement) {
                return k;
            }
        }
        return -1;
    };
}

if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (fn, scope) {
        for (var i = 0, len = this.length; i < len; ++i) {
            fn.call(scope, this[i], i, this);
        }
    };
}

if (!Array.prototype.filter) {
    Array.prototype.filter = function (fun /*, thisp*/) {
        "use strict";

        if (this == null)
            throw new TypeError();

        var t = Object(this);
        var len = t.length >>> 0;
        if (typeof fun != "function")
            throw new TypeError();

        var res = [];
        var thisp = arguments[1];
        for (var i = 0; i < len; i++) {
            if (i in t) {
                var val = t[i]; // in case fun mutates this
                if (fun.call(thisp, val, i, t))
                    res.push(val);
            }
        }

        return res;
    };
};/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

// SideTable is a weak map where possible. If WeakMap is not available the
// association is stored as an expando property.

// TODO(arv): WeakMap does not allow for Node etc to be keys in Firefox
if (typeof WeakMap !== 'undefined' && navigator.userAgent.indexOf('Firefox/') < 0) {
    window.SideTable = WeakMap;
} else {
    (function () {
        var defineProperty = Object.defineProperty,
            hasOwnProperty = Object.hasOwnProperty,
            counter = new Date().getTime() % 1e9;

        window.SideTable = function () {
            this.name = '__st' + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
        };

        window.SideTable.prototype = {
            'set'   : function (key, value) {
                defineProperty(key, this.name, {value: value, writable: true});
            },
            'get'   : function (key) {
                return hasOwnProperty.call(key, this.name) ? key[this.name] : undefined;
            },
            'delete': function (key) {
                this.set(key, undefined);
            }
        }
    })();
};
/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */


window.MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

if (!window.MutationObserver ){
(function() {

  var registrationsTable = new SideTable();

  // We use setImmediate or postMessage for our future callback.
  var setImmediate = window.SetImmediate || window.msSetImmediate;

  // Use post message to emulate setImmediate.
  if (!setImmediate) {
    var setImmediateQueue = [];
    var sentinel = String(Math.random());
    window.addEventListener('message', function(e) {
      if (e.data === sentinel) {
        var queue = setImmediateQueue;
        setImmediateQueue = [];
        queue.forEach(function(func) {
          func();
        });
      }
    });
    setImmediate = function(func) {
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
    observers.sort(function(o1, o2) {
      return o1.uid_ - o2.uid_;
    });

    var anyNonEmpty = false;
    observers.forEach(function(observer) {

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
    observer.nodes_.forEach(function(node) {
      var registrations = registrationsTable.get(node);
      if (!registrations)
        return;
      registrations.forEach(function(registration) {
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
    observe: function(target, options) {
        if (target.jquery) {target = target[0]}
      target = wrapIfNeeded(target);

      // 1.1
      if (!options.childList && !options.attributes && !options.characterData ||

          // 1.2
          options.attributeOldValue && !options.attributes ||

          // 1.3
          options.attributeFilter && options.attributeFilter.length &&
              !options.attributes ||

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

    disconnect: function() {
      this.nodes_.forEach(function(node) {
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

    takeRecords: function() {
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
    enqueue: function(record) {
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

    addListeners: function() {
      this.addListeners_(this.target);
    },

    addListeners_: function(node) {
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

    removeListeners: function() {
      this.removeListeners_(this.target);
    },

    removeListeners_: function(node) {
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
    addTransientObserver: function(node) {
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

    removeTransientObservers: function() {
      var transientObservedNodes = this.transientObservedNodes;
      this.transientObservedNodes = [];

      transientObservedNodes.forEach(function(node) {
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

    handleEvent: function(e) {
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

          forEachAncestorAndObserverEnqueueRecord(target, function(options) {
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


          forEachAncestorAndObserverEnqueueRecord(target, function(options) {
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

          forEachAncestorAndObserverEnqueueRecord(target, function(options) {
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

  window.MutationObserver = JsMutationObserver;

})();
};function check_if_exist() {
    if (arguments.length >= 2) {
        var error_message = Array.prototype.pop.call(arguments);
        var valid = true
        Array.prototype.forEach.call(arguments,function (argument) {
            if (argument === undefined || argument === null) {
                valid = false
            }
        });
        if (!valid) {
            console.error(error_message)
        }
        return valid
    }
    return false
}

function check_if_valid() {
    if (arguments.length >= 2) {
        var error_message = Array.prototype.pop.call(arguments);
        var valid = true
        Array.prototype.forEach.call(arguments,function (argument) {
            if (argument === false) {
                valid = false
            }
        });
        if (!valid) {
            console.error(error_message)
        }
        return valid
    }
    return false
};function set_node_content(node, content, overwrite) {
    if (overwrite) {
        node.innerHTML = content
    } else {
        node.insertAdjacentHTML('beforeend', content)
    }
}

$ajax = function (method, path, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4) {
            if (xmlhttp.status == 200) {
                if (callback) {
                    callback.call(xmlhttp, xmlhttp.responseText)
                }
            } else {
                console.error(path + ' is not reachable');
            }
        }
    };
    xmlhttp.open(method, path, true);
    xmlhttp.send();
};
$ajax.get = function (path, callback) {
    this('GET', path, callback)
};
$ajax.post = function (path, callback) {
    this('POST', path, callback)
};





function smart_eval(content){
    var output;
    try {
        output = eval('({' + content + '})');
    } catch (exception) {
        try {
            output = eval(content)
        } catch (exception) {
            output = content;
        }
    }
    return output;
};window.directive = (function () {
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