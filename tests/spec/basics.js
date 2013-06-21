describe('basic functionality', function() {
    it('in-class directive declaration', function() {
        var directiveCallback, directiveCalled, directiveName;
        directiveName = 'classTestDirective';
        directiveCallback = jasmine.createSpy(directiveName + 'Callback');
        directiveCalled = false;
        runs(function() {
            directive(directiveName, function() {
                directiveCalled = true;
                return directiveCallback();
            });
            expect(directiveCallback).not.toHaveBeenCalled();
            return $(document.body).append('<div class="' + directiveName + '"></div>');
        });
        waitsFor(function() {
            return directiveCalled;
        }, 'the directive should be called', 500);
        return runs(function() {
            return expect(directiveCallback).toHaveBeenCalled();
        });
    });
    it('attribute directive declaration', function() {
        var directiveCallback, directiveCalled, directiveName;
        directiveName = 'attrTestDirective';
        directiveCallback = jasmine.createSpy(directiveName + 'Callback');
        directiveCalled = false;
        runs(function() {
            directive(directiveName, function() {
                directiveCalled = true;
                return directiveCallback();
            });
            expect(directiveCallback).not.toHaveBeenCalled();
            return $(document.body).append('<div ' + directiveName + '></div>');
        });
        waitsFor(function() {
            return directiveCalled;
        }, 'the directive should be called', 500);
        return runs(function() {
            return expect(directiveCallback).toHaveBeenCalled();
        });
    });
    return it('shoot event on destruction', function() {
        var directiveCallback, directiveName, directiveUnloaderCalled, elementExists;
        directiveName = 'removeTestDirective';
        directiveCallback = jasmine.createSpy(directiveName + 'Callback');
        elementExists = false;
        directiveUnloaderCalled = false;
        runs(function() {
            var someInterval;
            directive(directiveName, {
                unload: function() {
                    directiveUnloaderCalled = true;
                    return directiveCallback();
                }
            });
            $(document.body).append('<div class="' + directiveName + '"></div>');
            expect(directiveCallback).not.toHaveBeenCalled();
            return someInterval = setInterval(function() {
                if ($('.' + directiveName).length > 0) {
                    elementExists = true;
                    return clearInterval(someInterval);
                }
            }, 50);
        });
        waitsFor(function() {
            return elementExists;
        }, 'the directive element should be created', 500);
        runs(function() {
            return $("." + directiveName).remove();
        });
        waitsFor(function() {
            return directiveUnloaderCalled;
        }, 'the directive destructor should be called', 500);
        return runs(function() {
            return expect(directiveCallback).toHaveBeenCalled();
        });
    });
});