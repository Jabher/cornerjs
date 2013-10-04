describe "attributes support", ->
  it "explicitly declare value", ->
    directiveCalled = undefined
    directiveName = undefined
    directiveValue = undefined
    obtainedValue = undefined
    directiveName = "attrValueTestDirective"
    directiveValue = 5
    directiveCalled = false
    obtainedValue = undefined
    runs ->
      directive directiveName, (node, attr) ->
        directiveCalled = true
        obtainedValue = attr

      $(document.body).append "<div " + directiveName + "=\"" + directiveValue + "\"></div>"

    waitsFor (->
      directiveCalled
    ), "the directive should be called", 100
    runs ->
      expect(obtainedValue).toEqual directiveValue


  it "implicitly declare object value", ->
    directiveCalled = undefined
    directiveName = undefined
    directiveValue = undefined
    obtainedValue = undefined
    directiveName = "attrValueObjectTestDirective"
    directiveValue = 5
    directiveCalled = false
    obtainedValue = undefined
    runs ->
      directive directiveName, (node, attr) ->
        directiveCalled = true
        obtainedValue = attr.a

      $(document.body).append "<div " + directiveName + "=\"a: " + directiveValue + "\"></div>"

    waitsFor (->
      directiveCalled
    ), "the directive should be called", 100
    runs ->
      expect(obtainedValue).toEqual directiveValue


  it "support values in tag attributes", ->
    directiveCalled = undefined
    directiveName = undefined
    directiveValue = undefined
    obtainedValue = undefined
    directiveName = "attrTagAttrValueObjectTestDirective"
    directiveValue = 5
    directiveCalled = false
    obtainedValue = undefined
    runs ->
      directive directiveName, (node, attr) ->
        directiveCalled = true
        obtainedValue = attr.a

      $(document.body).append "<" + directiveName + " a=" + directiveValue + "/>"

    waitsFor (->
      directiveCalled
    ), "the directive should be called", 100
    runs ->
      expect(obtainedValue).toEqual directiveValue


