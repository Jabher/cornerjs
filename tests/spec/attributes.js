describe('attributes support', function() {
    it('explicitly declare value', function() {
        var directiveCalled, directiveName, directiveValue, obtainedValue;
        directiveName = 'attrValueTestDirective';
        directiveValue = 5;
        directiveCalled = false;
        obtainedValue = void 0;
        runs(function() {
            directive(directiveName, function(node, attr) {
                directiveCalled = true;
                return obtainedValue = attr;
            });
            return $(document.body).append('<div ' + directiveName + '="' + directiveValue + '"></div>');
        });
        waitsFor(function() {
            return directiveCalled;
        }, 'the directive should be called', 100);
        return runs(function() {
            return expect(obtainedValue).toEqual(directiveValue);
        });
    });
    return it('implicitly declare object value', function() {
        var directiveCalled, directiveName, directiveValue, obtainedValue;
        directiveName = 'attrValueObjectTestDirective';
        directiveValue = 5;
        directiveCalled = false;
        obtainedValue = void 0;
        runs(function() {
            directive(directiveName, function(node, attr) {
                directiveCalled = true;
                return obtainedValue = attr.a;
            });
            return $(document.body).append('<div ' + directiveName + '="a: ' + directiveValue + '"></div>');
        });
        waitsFor(function() {
            return directiveCalled;
        }, 'the directive should be called', 100);
        return runs(function() {
            return expect(obtainedValue).toEqual(directiveValue);
        });
    });
});