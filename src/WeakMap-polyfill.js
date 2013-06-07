/*
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
            set   : function (key, value) {
                defineProperty(key, this.name, {value: value, writable: true});
            },
            get   : function (key) {
                return hasOwnProperty.call(key, this.name) ? key[this.name] : undefined;
            },
            delete: function (key) {
                this.set(key, undefined);
            }
        }
    })();
}