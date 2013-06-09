describe 'templates loading support', ->
  it 'loads template', ->
    directiveName = 'templateLoadDirective'
    templateElementId = "unique-selector-for" + directiveName

    runs ->
      directive directiveName, {
        template: "<div id='#{templateElementId}'></div>"
      }
      $(document.body).append('<div ' + directiveName + '></div>')

    waitsFor ->
      document.getElementById(templateElementId) != null
    , 'the element in template should be called', 100

    runs ->
      expect(document.getElementById(templateElementId)).not.toEqual(null)


  it 'loads template from URL', ->
    directiveName = 'templateUrlLoadDirective'
    templateUrl = "dummy/sample-template.html"
    templateElementId = "sample-template-element-id"

    runs ->
      directive directiveName,
        template_url: templateUrl

      $(document.body).append('<div ' + directiveName + '></div>')

    waitsFor ->
      document.getElementById(templateElementId) != null
    , 'the element in template should be called', 500

    runs ->
      expect(document.getElementById(templateElementId)).not.toEqual(null)
