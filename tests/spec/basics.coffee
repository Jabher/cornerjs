describe "basic functionality", ->
  it "in-class directive declaration", ->
    directiveCallback = undefined
    directiveCalled = undefined
    directiveName = undefined
    directiveName = "classTestDirective"
    directiveCallback = jasmine.createSpy(directiveName + "Callback")
    directiveCalled = false
    runs ->
      directive directiveName, ->
        directiveCalled = true
        directiveCallback()

      expect(directiveCallback).not.toHaveBeenCalled()
      $(document.body).append "<div class=\"" + directiveName + "\"></div>"

    waitsFor (->
      directiveCalled
    ), "the directive should be called", 500
    runs ->
      expect(directiveCallback).toHaveBeenCalled()


  it "attribute directive declaration", ->
    directiveCallback = undefined
    directiveCalled = undefined
    directiveName = undefined
    directiveName = "attrTestDirective"
    directiveCallback = jasmine.createSpy(directiveName + "Callback")
    directiveCalled = false
    runs ->
      directive directiveName, ->
        directiveCalled = true
        directiveCallback()

      expect(directiveCallback).not.toHaveBeenCalled()
      $(document.body).append "<div " + directiveName + "></div>"

    waitsFor (->
      directiveCalled
    ), "the directive should be called", 500
    runs ->
      expect(directiveCallback).toHaveBeenCalled()


  it "tag directive declaration", ->
    directiveCallback = undefined
    directiveCalled = undefined
    directiveName = undefined
    directiveName = "attrTagDirective"
    directiveCallback = jasmine.createSpy(directiveName + "Callback")
    directiveCalled = false
    runs ->
      directive directiveName, ->
        directiveCalled = true
        directiveCallback()

      expect(directiveCallback).not.toHaveBeenCalled()
      $(document.body).append "<" + directiveName + "/>"

    waitsFor (->
      directiveCalled
    ), "the directive should be called", 500
    runs ->
      expect(directiveCallback).toHaveBeenCalled()


  it "shoot event on destruction", ->
    directiveCallback = undefined
    directiveName = undefined
    directiveUnloaderCalled = undefined
    elementExists = undefined
    directiveName = "removeTestDirective"
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
      $("." + directiveName).remove()

    waitsFor (->
      directiveUnloaderCalled
    ), "the directive destructor should be called", 500
    runs ->
      expect(directiveCallback).toHaveBeenCalled()


