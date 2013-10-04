directive('preload-css-images', function(){
    var image_regexp = /url\(['"]?\S*['"]?\)/;
    for (var i = 0; i < document.styleSheets.length; i++) {
        var styleSheet = document.styleSheets[i];
        var rules = styleSheet.cssRules || styleSheet.rules;
        if (rules && rules.length)
            for (var j = 0; j < rules.length; j++) {
                var ruleText = rules[j].cssText;
                if (ruleText){
                    var image_urls = image_regexp.exec(ruleText);
                    if (image_urls && image_urls.length)
                        for (var k = 0; k < image_urls.length; k++) {
                            document.createElement('img').src = image_urls[k]
                                .replace('url(', '')
                                .replace(')', '')
                                .split('"').join('')
                                .split("'").join('');
                        }
                }
            }
    }
});