# CornerJS

Easy to use directives engine, that gives you a super-ability just to put into the far corner stuff you want to forget about:
 - social buttons
 - animations
 - intervals and timeouts
 - on-element-appear actions
 - custom scrolls

It's totally not about data-binding and models. It's about throwing away all the pieces of code that are not connected with anything else and depends only on their appearance in DOM tree.

It works in IE9+, latest FF, Safari, Chrome, Opera, Android 4+(no information about 3.0, not working in 2.3) etc. Feel free to report about browser support, especially I'll appreciate information about iOS support.
IE and some other browsers are working over polyfill by Polymer brothers.

How it works?

    directive('foo', function(){alert('bar')});

Aaaand yup. That's it.
You can now append

    <div class='foo'>

or

    <div foo>

or

    <div data-foo>

or even

    <div directive-foo="baz">

and even an amazing

    <foo bar="baz"/>

and you'll get access to all the properties

## Syntax

expanded syntax:

    directive('directive-name', {
        load: function(node, attribute){},
        unload: function(node, attribute){},
        alter: function(node, attribute){},
    })

short syntax:

    directive('directive-name', function(node, attribute){});

is equal to

    directive('directive-name', {
            load: function(node, attribute){}
        })

Load is called on event appearance in DOM tree, unload - on removal, alter - on attribute change.
'template_url' has priority over 'template', overwrite is condition if content should be replaced.

if you initialise only {alter: } function, it automatically gets bind to load also. This is done to implement easily all the actions to be done on both load and alter, such as include directive

Local scope contains following by default:
{
    directive: {<...original directive content; you can alter methods on-the-fly, but actually only alter and unload changes will be reasonable...>},
    node: original node
}

You can extend it easily to use for your own purposes:

directive('directive-name', {
    load: function(node, attribute){
        this.interval = setInterval(function(){console.log('hi!')}, 100)
    },
    unload: function(node, attribute){
        clearInterval(this.interval)
    }
})

node will contain also some new properties: each one for directive named in the same way(local scope will be there, so you will be able to access easily to scope properties, e.g. carousel control directive will be able to access carousel container directive), also 'directives' and 'directive_aliases'. You should ignore them, they are mostly for technical purposes.

 Yes, it's not good to use global scope elements, but all other solutions I've saw were with dramatical memory usage or high CPU load, so for now it's the only way.

## Attributes usage

It has some magic also.

    <div directive-foo="baz">

returns as attribute

    'baz'

But if you'll input

    <div directive-foo="baz: 'baz'">

it will bring you

     {baz: 'baz'}

It is based on window.eval, so you are able to do every piece of code possible.
First it alledge that curvy braces are omitted, then if eval fails forgets about it and attempts a second try with direct content eval(). If even this fails original string is passed.

## Mechanics details
attribute directive has priority over the class directive. If you have

<div class="data-directive_name directive_name" directive_name="some_value" data-directive_name="some_other_value">

...well, you dig that pit for yourself by your own hands.
 Actually you can do it as logic is bright and clear:
- first it passes through class list
- next it passes through attributes list

pass order inside array is also simple: first goes non-prefixed value, then all the prefixes value.
I strongly recommend to leave config in the beginning as-is or at least leave "data" prefix at the beginning.

## jQuery
If you are using jQuery just use $('#selector')[0] to get access to original node


##Current bugs
IE 9 and 10 do not support attribute removal from the node. It is allegedly connected with mutationobserver polyfill, and is uncommon situation(usually it is done by hands rather by manipulating DOM), so it should be just taken in mind that it is recommended to remove node, not attribute directive. Otherwise you can use class and tag directives.

## Plans for future

- Speed tests