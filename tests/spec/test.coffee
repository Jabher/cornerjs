describe 'abilities integrity', ->

  it 'should have EC5 Array extensions', ->
    expect(typeof Array.prototype.forEach).toBe(typeof ->)
    expect(typeof Array.prototype.indexOf).toBe(typeof ->)
    expect(typeof Array.prototype.filter).toBe(typeof ->)

  it 'should have MutationObserver(or polyfill) support', ->
    expect(MutationObserver).not.toBe(undefined)