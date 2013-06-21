describe('abilities integrity', function() {
    it('has EC5 Array extensions', function() {
        expect(Array.prototype.forEach).toEqual(jasmine.any(Function));
        expect(Array.prototype.indexOf).toEqual(jasmine.any(Function));
        return expect(Array.prototype.filter).toEqual(jasmine.any(Function));
    });
    it('has MutationObserver(or polyfill) support', function() {
        return expect(MutationObserver).not.toBe(void 0);
    });
    return it('has cornerJS directive engine attached', function() {
        return expect(window.directive).not.toBe(void 0);
    });
});