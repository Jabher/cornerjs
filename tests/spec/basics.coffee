describe 'basic functionality', ->
  it 'in-class directive declaration', ->
    directiveName = 'classTestDirective'
    directiveCallback = jasmine.createSpy(directiveName + 'Callback')
    directiveCalled = false

    runs ->
      directive directiveName, ->
        directiveCalled = true
        directiveCallback()

      expect(directiveCallback).not.toHaveBeenCalled()
      $(document.body).append('<div class="' + directiveName + '"></div>')

    waitsFor(->
      directiveCalled
    , 'the directive should be called', 100)

    runs ->
      expect(directiveCallback).toHaveBeenCalled()


  it 'attribute directive declaration', ->
    directiveName = 'attrTestDirective'
    directiveCallback = jasmine.createSpy(directiveName + 'Callback')
    directiveCalled = false

    runs ->
      directive directiveName, (attr)->
        directiveCalled = true
        obtainedValue = attr
        directiveCallback()

      expect(directiveCallback).not.toHaveBeenCalled()
      $(document.body).append('<div ' + directiveName + '></div>')

    waitsFor(->
      directiveCalled
    , 'the directive should be called', 100)

    runs ->
      expect(directiveCallback).toHaveBeenCalled()


  it 'shoot event on destruction', ->
    directiveName = 'removeTestDirective'
    directiveCallback = jasmine.createSpy(directiveName + 'Callback')
    elementExists = false
    directiveUnloaderCalled = false
    runs ->
      directive directiveName, {
        unload: ->
          directiveUnloaderCalled = true
          directiveCallback()
      }

      $(document.body).append('<div class="' + directiveName + '"></div>')
      expect(directiveCallback).not.toHaveBeenCalled()
      someInterval = setInterval(->
        if $('.' + directiveName).length > 0
          elementExists = true
          clearInterval(someInterval)
      , 50)

    waitsFor(->
      elementExists
    , 'the directive element should be created', 500)

    runs ->
      $("." + directiveName).remove()

    waitsFor(->
      directiveUnloaderCalled
    , 'the directive destructor should be called', 500)


    runs ->
      expect(directiveCallback).toHaveBeenCalled()