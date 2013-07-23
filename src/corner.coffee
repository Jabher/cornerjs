Object.defineProperty Array::, 'flatten',
  get: ->
    ->
      a = []
      a = a.concat(if element.flatten then element.flatten() else element) for element in @ when element?
      a

window.directive = do ->
  config =
    prefixes: ["data-", "directive-", ""]
    ignored_attributes: ["class", "href"]


  smart_eval = (content) ->
    output = content
    if typeof output == 'string'
      try output = eval(content)
      try output = eval("({" + content + "})")
    output
  put_in_queue = (func) ->     #mutationObserver sometimes not detecting html change events in callback itself
    setTimeout func, 0
  apply_directives_in_subtree = (action, node) ->
    #child directives should be initialised earlier then parent ones
    apply_directives_in_subtree(action, child) for child in node.children if node.children
    switch action
      when "load" then node_loaded node
      when "unload" then node_unloaded node

  parse_node_attrs = (node)->
    attrHash = {}
    attrHash[attribute.name] = smart_eval(attribute.value) for attribute in node.attributes if node.attributes
    attrHash

  #resolvers section. New resolvers should be added here
  resolve_directives_in_classes = (node) ->
    for class_name in node.classList or (node.className and node.className.split(" ")) or []
      for own directive_name, directive of directives
        for prefix in config.prefixes when class_name.toLowerCase() is (prefix + directive_name)
          directive: directive
          type: 'class'

  resolve_directives_in_attributes = (node) ->
    for attribute in node.attributes or [] when config.ignored_attributes.indexOf(attribute.name) is -1
      for own directive_name, directive of directives
        for prefix in config.prefixes when attribute.name.toLowerCase() is (prefix + directive_name)
          directive: directive
          attribute_name:attribute.name.toLowerCase()
          attribute: attribute.value
          type: 'attribute'

  resolve_directives_in_tag = (node) ->
    return [] unless node.tagName?
    for own directive_name, directive of directives
      for prefix in config.prefixes when node.tagName.toLowerCase() is (prefix + directive_name)
          directive: directive
          type: 'tag'
          attribute_name: node.tagName
          attribute: parse_node_attrs node

  #events processor section. New processors should be added here
  node_loaded = (node) ->
    node.directives ||= {}
    node.directive_aliases ||= {}
    instances = []
    .concat(resolve_directives_in_classes(node))
    .concat(resolve_directives_in_attributes(node))
    .concat(resolve_directives_in_tag(node))
    .flatten()
    for instance in instances
      node.directives[instance.directive.name] = instance
      if instance.attribute_name
        node.directive_aliases[instance.attribute_name] = instance

    for directive_name, node_directive of node.directives when not node[directive_name]?
      node[directive_name] =
        directive: node_directive
        node: node
      directive = node_directive.directive
      put_in_queue directive.load.bind(node[directive.name], node, smart_eval(node_directive.attribute)) if directive.load

  node_unloaded = (node) ->
    if node.directives
      for directive_name, node_directive of node.directives when node_directive? and directives[directive_name].unload?
        put_in_queue directives[directive_name].unload.bind(node[directive_name], node, smart_eval(node_directive.attribute))

  node_altered = (node, mutationRecord) ->
    if node.directive_aliases
      if node.directives[node.tagName.toLowerCase()]
        put_in_queue node_directive_scope.directive.alter.bind(node_directive_scope, node, parse_node_attrs node)
      node_directive_scope = node.directive_aliases[mutationRecord.attributeName]
      if node_directive_scope and node_directive_scope.attribute and node_directive_scope.directive.alter
        put_in_queue node_directive_scope.directive.alter.bind(node_directive_scope, node, smart_eval(node.attributes.getNamedItem(mutationRecord.attributeName).value))

  #directive creation section
  create_directive = (name, directive) ->
    if directive instanceof Function
      directive =
        load: directive
    directive.load = directive.alter unless directive.load?
    directive.name = name.toLowerCase()
    directives[directive.name] = directive
    node_loaded(document.body) if document.readyState is "complete"


  #observer shooter
  observer_function = (mutationRecords) ->
    Array::forEach.call mutationRecords, (mutationRecord) ->
      switch mutationRecord.type
        when "attributes" then node_altered mutationRecord.target, mutationRecord
        else
          apply_directives_in_subtree("load", addedNode) for addedNode in mutationRecord.addedNodes
          apply_directives_in_subtree("unload", removedNode) for removedNode in mutationRecord.removedNodes

  directives = {}
  observer = new MutationObserver(observer_function)
  directive_processor = (directive_name, directive_body) ->
    throw new TypeError("incorrect directive format")  if (directive_name.constructor isnt String) or (not ((directive_body instanceof Object) or (directive_body instanceof Function)))
    throw "trying to register already registered directive " + directive_name  if directives[directive_name.toLowerCase()]

    create_directive directive_name, directive_body


  shoot_observer = ->
    #emulating mutationObserver call with whole body after it's ready. It's quite better and gives browser a chance to load faster and not disturb on callback loop.
    observer_function [
      addedNodes: [document.body]
      removedNodes: []
      target: document.body
    ]
    observer.observe document.body,
      attributes: true
      childList: true
      subtree: true
  if document.readyState is "complete"
    shoot_observer()
  else
    document.addEventListener "DOMContentLoaded", shoot_observer, false
  directive_processor