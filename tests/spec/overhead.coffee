describe "new unexpected scenarios", ->
  it "support class directive attachment after node creation", ->
    directiveCalled = undefined
    directiveName = undefined
    directiveValue = undefined
    obtainedValue = undefined
    directiveName = "afterCreationClassTestDirective"
    directiveValue = 5
    directiveCalled = false
    obtainedValue = undefined
    runs ->
      directive directiveName, (node) ->
        directiveCalled = true
      $("<div></div>").appendTo(document.body).addClass(directiveName)

    waitsFor (->
      directiveCalled
    ), "the directive should be called", 100
    runs ->
      expect(directiveCalled).toEqual true

  it "support attribute directive attachment after node creation", ->
    directiveCalled = undefined
    directiveName = undefined
    directiveValue = undefined
    obtainedValue = undefined
    directiveName = "afterCreationAttrTestDirective"
    directiveValue = 5
    directiveCalled = false
    obtainedValue = undefined
    runs ->
      directive directiveName, (node, attr) ->
        directiveCalled = true
        obtainedValue = attr
      $("<div></div>").appendTo(document.body).attr(directiveName, directiveValue)

    waitsFor (->
      directiveCalled
    ), "the directive should be called", 100
    runs ->
      expect(obtainedValue).toEqual directiveValue

  it "shoot event on class removal", ->
    directiveCallback = undefined
    directiveName = undefined
    directiveUnloaderCalled = undefined
    elementExists = undefined
    directiveName = "classRemovalTestDirective"
    directiveCallback = jasmine.createSpy(directiveName + "Callback")
    elementExists = false
    directiveUnloaderCalled = false
    runs ->
      someInterval = undefined
      directive directiveName,
        unload: ->
          directiveUnloaderCalled = true
          directiveCallback()

      $(document.body).append "<div class=\"" + directiveName + "\"></div>"
      expect(directiveCallback).not.toHaveBeenCalled()
      someInterval = setInterval(->
        if $("." + directiveName).length > 0
          elementExists = true
          clearInterval someInterval
      , 50)

    waitsFor (->
      elementExists
    ), "the directive element should be created", 500
    runs ->
      $("." + directiveName).removeClass(directiveName)

    waitsFor (->
      directiveUnloaderCalled
    ), "the directive destructor should be called", 500
    runs ->
      expect(directiveCallback).toHaveBeenCalled()

  it "shoot event on attribute removal", ->
    directiveCallback = undefined
    directiveName = undefined
    directiveUnloaderCalled = undefined
    elementExists = undefined
    directiveName = "attrRemovalTestDirective"
    directiveCallback = jasmine.createSpy(directiveName + "Callback")
    elementExists = false
    directiveUnloaderCalled = false
    runs ->
      someInterval = undefined
      directive directiveName,
        unload: ->
          directiveUnloaderCalled = true
          directiveCallback()

      $(document.body).append "<div " + directiveName + "></div>"
      expect(directiveCallback).not.toHaveBeenCalled()
      someInterval = setInterval(->
        if $("[" + directiveName + "]").length > 0
          elementExists = true
          clearInterval someInterval
      , 50)

    waitsFor (->
      elementExists
    ), "the directive element should be created", 500
    runs ->
      $("[" + directiveName+"]").attr(directiveName, null)

    waitsFor (->
      directiveUnloaderCalled
    ), "the directive destructor should be called", 500
    runs ->
      expect(directiveCallback).toHaveBeenCalled()