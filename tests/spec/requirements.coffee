describe 'abilities integrity', ->
  it 'has EC5 Array extensions', ->
    expect(Array.prototype.forEach).toEqual(jasmine.any Function)
    expect(Array.prototype.indexOf).toEqual(jasmine.any Function)
    expect(Array.prototype.filter).toEqual(jasmine.any Function)

  it 'has MutationObserver(or polyfill) support', ->
    expect(MutationObserver).not.toBe(undefined)
  it 'has cornerJS directive engine attached', ->
    expect(window.directive).not.toBe(undefined)
