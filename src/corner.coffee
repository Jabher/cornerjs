do ->
  config =
    prefixes: ['data-', 'directive-', '']
  WeakMap = ->
    keyList = []
    valueList = []
    Object.freeze
      get: (key, defaultValue) ->
        index = keyList.indexOf(key)
        value = valueList[index]
        (if index is -1 then defaultValue else value)

      has: (key) ->
        index = keyList.indexOf(key)
        (index isnt -1)

      set: (key, value) ->
        throw new TypeError("WeakMap key must not be a value type")  if key isnt Object(key)
        index = keyList.indexOf(key)
        if index is -1
          keyList.push key
          valueList.push value
        else
          valueList[index] = value

      delete: (key) ->
        index = keyList.indexOf(key)
        keyList = keyList.slice(0, index).concat(keyList.slice(index + 1))
        valueList = valueList.slice(0, index).concat(valueList.slice(index + 1))

      clear: ->
        keyList = []
        valueList = []

  smartEval = (content) ->
    output = content
    try output = eval(content)
    try output = eval("({" + content + "})")
    output

  directiveList = []


  addedNodesDirectiveHandler = (nodeList, directive)->
    for node in nodeList
      directive.checkNode(node)
    addedNodesDirectiveHandler(node.children, directive) for node in nodeList when node.children


  class Directive
    constructor: (@directiveName, @onLoad, @onUnload, @onAlter)->
      @name = @directiveName.toLowerCase()
      @directiveName = @directiveName.replace(/^./, (a)->a.toUpperCase())
      console.log(@directiveName)
      @nodeMap = new WeakMap
      @aliases = config.prefixes.map (prefix) =>
        prefix + @name
      if observerLaunched
        Array::forEach.call(document.querySelectorAll(
          [
            @aliases.map((a) ->
              a).join(' , '),
            @aliases.map((a) ->
              '.' + a).join(' , '),
            @aliases.map((a) ->
              '[' + a + ']').join(' , '),
          ].join(' , ')
        ), (node)->
          @testNode(node))


    getTagAttributesValue: (node)->
      argsObject = {}
      for attribute in node.attributes
        argsObject[attribute.name] = smartEval(attribute.value)
      argsObject
    getAttributeValue: (attribute)->
      smartEval(attribute.value)
    executeDirectiveAction: (node, state, action)->
      if action
        switch state.type
          when 'attribute'
            if state.attribute.value isnt state.attributeValue
              state.attributeValue = state.attribute.value
              action.call(state.scope, node, @getAttributeValue(state.attribute))
          when 'tag'
            action.call(state.scope, node, @getTagAttributesValue(node))
          when 'class'
            action.call(state.scope, node)

    directiveLoaded: (node, state)->
      node['directive' + @directiveName] = state.scope = {}
      @executeDirectiveAction(node, state, @onLoad)
    directiveAttributeAltered: (node, state)->
      if @testNode(node)
        @executeDirectiveAction(node, state, @onAlter)
      else
        @directiveUnloaded(node, state)
    directiveUnloaded: (node, state)->
      @onUnload(state.scope, node)

    testNode: (node)->
      if node.tagName and node.attributes
        classList = (node.className || '').split(' ').filter((a)->
          a.length).map((a) ->
          a.toLowerCase())
        for alias in @aliases
          if classList.indexOf(alias) isnt -1
            return {
            type: 'class',
            className: alias
            }
          if node.attributes.getNamedItem(alias)
            return {
            type: 'attribute',
            attributeName: alias,
            attribute: node.attributes.getNamedItem(alias)
            }
          if node.tagName.toLowerCase() == alias
            return {
            type: 'tag',
            tagName: alias,
            tag: node
            }

    registerClass: (node, state)->
      state.observer = new MutationObserver ()=>
        @directiveUnloaded(node, state) unless @testNode(node)
      state.observer.observe(node, {attributes: true})
      @directiveLoaded(node, state)

    registerAttribute: (node, state)->
      state.observer = new MutationObserver ()=>
        @directiveAttributeAltered(node, state)
      state.observer.observe(node, {attributes: true})
      @directiveLoaded(node, state)

    registerTag: (node, state)->
      state.observer = new MutationObserver ()=>
        @directiveAttributeAltered(node, state)
      state.observer.observe(node, {attributes: true})
      @directiveLoaded(node, state)

    checkNode: (node)->
      unless @nodeMap.has(node)
        state = @testNode(node)
        if state
          @nodeMap.set(node, state)
          switch state.type
            when 'tag' then @registerTag(node, state)
            when 'attribute' then @registerAttribute(node, state)
            when 'class' then @registerClass(node, state)
    checkRemovingNode: (node)->
      if state = @nodeMap.get(node)
        @directiveUnloaded(node, state)


  addedNodesHandler = (nodeList)->
    for node in nodeList
      directive.checkNode(node) for directive in directiveList

    for node in nodeList when node.children
      addedNodesHandler(node.children)

  removedNodesHandler = (nodeList)->
    for node in nodeList
      directive.checkRemovingNode(node) for directive in directiveList

    for node in nodeList when node.children
      removedNodesHandler(node.children)

  mutationRecordHandler = (mutationRecord) ->
    switch mutationRecord.type
      when 'childList'
        addedNodesHandler(mutationRecord.addedNodes)
        removedNodesHandler(mutationRecord.removedNodes)


  mutationRecordListHandler = (mutationRecordList)->
    mutationRecordHandler(mutationRecord) for mutationRecord in mutationRecordList
  observer = new MutationObserver(mutationRecordListHandler)
  observerLaunched = false
  shootObserver = ->
    #emulating mutationObserver call with whole body after it's ready. It's quite better and gives browser a chance to load faster and not disturb on callback loop.
    mutationRecordListHandler [
      addedNodes: [document.body]
      removedNodes: [],
      target: document.body
    ]
    observer.observe document.body,
      attributes: true
      childList: true
      subtree: true
    observerLaunched = true
  if document.readyState is "complete"
    shootObserver()
  else
    document.addEventListener "DOMContentLoaded", shootObserver.bind(document.body), false


  window.directive = (name, config) ->
    if config instanceof Function
      config =
        load: config
    directiveList.push new Directive(name, config.load || config.alter, config.unload, config.alter)
    return undefined