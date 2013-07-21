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
})();