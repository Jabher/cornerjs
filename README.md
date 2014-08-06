CornerJS. HTML APIs re-imagined
===

Did you ever have a feeling that your (or someone else's plugin) has too heavy interface?

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
In that case **video-player** directive will not be executed.

## Why it should blow my mind?
Because 80% of code on every website is about isolated widgets.
Sometimes 100%.
Then you should create a specific API to handle stuff on your page.
After that you create this code, you should take care about load conditions, page load, popups, page changes, preload and all other stuff.

Now you can create APIs that are already familiar: attributes and classes, so that web designers can work apart from developers.
You can isolate JS logic inside an element in simplest way ever.
You make your code in less nested way.
You can provide horizontal scaling instead of coplexity growth.
If you want to cover your website with tests, you need just to cover every widget: they are not interfering with each other.

## So why again, why it is so good? I want you to excite me with lot of complex words!

CornerJS relies upon native DOM interfaces and lets you create new APIs over HTML.
It is as robust, solid and as-fast-as-possible - CornerJS relies upon MutationObserver API that shoots callbacks exactly after DOM changes.
Manipulations inside the callbacks are likely to be applied before page will be re-rendered, so user very likely will not even see non-loaded component.

Component paradigm of CornerJS is a great case of functional design, where every module implements only one function.
It allows you to isolate business logic and visual components and scale horizontally.

## Most common use cases
+ Widget or component initializer (efficiency feels most on AJAXful websites)
+ Custom input fields
+ Custom social plugins
+ "dirty" hacks over HTML manipulation in existing application
+ AJAX navigation: links default behaviour override
+ conditional script load: loading required scripts/styles only if this page needs it

## Possibly weird behaviour (if not familiar)
If some widget is acting in not expected way, you'd rather check if multiple directives are registered.
If both of them are manipulating DOM, result can vary.

## Current bugs
IE 9 and 10 do not support attribute removal from the node. It is allegedly connected with mutationobserver polyfill, and is uncommon situation(usually it is done by hands rather by manipulating DOM), so it should be just taken in mind that it is recommended to remove node, not attribute directive. Otherwise you can use class and tag directives.