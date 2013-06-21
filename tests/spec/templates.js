describe('templates loading support', function() {
    it('loads template', function() {
        var directiveName, templateElementId;
        directiveName = 'templateLoadDirective';
        templateElementId = "unique-selector-for" + directiveName;
        runs(function() {
            directive(directiveName, {
                template: "<div id='" + templateElementId + "'></div>"
            });
            return $(document.body).append('<div ' + directiveName + '></div>');
        });
        waitsFor(function() {
            return document.getElementById(templateElementId) !== null;
        }, 'the element in template should be called', 100);
        return runs(function() {
            return expect(document.getElementById(templateElementId)).not.toEqual(null);
        });
    });
    return it('loads template from URL', function() {
        var directiveName, templateElementId, templateUrl;
        directiveName = 'templateUrlLoadDirective';
        templateUrl = "dummy/sample-template.html";
        templateElementId = "sample-template-element-id";
        runs(function() {
            directive(directiveName, {
                template_url: templateUrl
            });
            return $(document.body).append('<div ' + directiveName + '></div>');
        });
        waitsFor(function() {
            return document.getElementById(templateElementId) !== null;
        }, 'the element in template should be called', 500);
        return runs(function() {
            return expect(document.getElementById(templateElementId)).not.toEqual(null);
        });
    });
});