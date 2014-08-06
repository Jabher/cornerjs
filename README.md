CornerJS. HTML APIs reimagined
===

Did you ever have a feeling that your (or someone else's plugin) has too heavy interface.

Ever felt ashamed for something like
```html
<script src="/scripts/jquery.js"/>
<script src="/scripts/jquery.myplugin.js"/>
<div class="my-plugin-target"/>
<script>
  $(function(){
    $('.my-plugin-target').myplugin();
  })
```

Ever wanted something a bit simplier?

What if I say that it could be like

```html
<script src="/scripts/myplugin.js"/>
<div class="my-plugin-target"/>
```

and nothing more?

I'm serious. No jquery for simple plugins. No awaits of the DOMContentLoaded. 
You need your own element to load, why should you care about all the content? 
Why do you ever give your users JS api? You've created isolated visual plugin.
Look at 
<input type="color">
It's damn colorpicker, and it just works. It does not require any JS initialisation. 
That's why web designers, who are not familiar with JS, use it and does not your amazing plugin.
 
Most of JS libs are just something binded to DOM element, so stop lying to yourself: HTML-only api will make your lib more beautiful.

CornerJS has just 8kb (2.5kb gzipped) footprint, so you can include it care-free in your lib. If you are relying upon latest browsers that support **MutationObserver**, you can just use **/src/corner.js**, which is 2.5kb minified (without gzip).

How to really use it?

## Easy jQuery plugin wrapper
```javascript
directive('myplugin', function(element){
    $(element).myplugin();
})
```
Yes, that's all.
You can use it so:
```html
<div class="myplugin">
<div myplugin/>
<myplugin>
```

If you need to pass some params: 
```html
<div myplugin="width: 100, height: 200"/>
<myplugin width=100 height=200 />
```
```javascript
directive('myplugin', function(element, opts){
    console.log(opts); //=> {width: 100, height: 200}
    $(element).myplugin(opts); 
})
```
If you need to make a destructor
```javascript
directive('myplugin', {
    load: function(element){
       $(element).myplugin();
    },
    unload: function(element){
        $(element).myplugin('destroy');
    }
})
```
And even share something between callbacks

```javascript
directive('myplugin', {
    load: function(element){
       this.request = createRequest();
    },
    unload: function(element){
        this.request.abort();
    }
})
```

Or maybe you want to listen for attribute changes and process them?

```javascript
directive('myplugin', {
    alter: function(element, opts){
       element.innerHTML = opts.content;
    }
})
```

### Note
If only **alter** callback is defined, it is also called on element load. 
It is done due to a lot of cases when load and alter logic are identical.

## API spec
Shorthand method
    directive(String directiveName, Function loadCallback)
is equal to 
    directive(String directiveName, {load: Function loadCallback})
Full method
    directive(String directiveName, {
        \[load:   Function loadCallback\]
        \[alter:  Function alterCallback\]
        \[unload: Function unloadCallback\]
    })
## Mechanics details
If you created something like
<directive-name class="directive_name" directive_name="some_value">

you should note that only one **load** event will shoot.
Tags have priority over attributes, attributes have priority over classes.

If you have nested directives, note that load sequence has event capturing logic - from parent element to child ones.
unload sequence is bubbling: from children to parent.
It is useful when you want to use element as template container, e.g.

```html
<div handlebars-template-with-data-from-url="some.url">
    <video-player src="{{url}}">
</div>
```
```javascript
directive('handlebars-template-with-data-from-url', function(el){
    this.template = el.innerHTML;
    el.innerHTML = '';
    //...do magic...
});
```
In that case **video-player** will not be executed.


##Current bugs
IE 9 and 10 do not support attribute removal from the node. It is allegedly connected with mutationobserver polyfill, and is uncommon situation(usually it is done by hands rather by manipulating DOM), so it should be just taken in mind that it is recommended to remove node, not attribute directive. Otherwise you can use class and tag directives.