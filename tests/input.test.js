const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(file) {
  const elements = new Map();
  const timers = new Map();
  let timerId = 0;
  class Element {
    constructor() {
      this.style = {};
      this.attributes = {};
      this.listeners = {};
      this.children = [];
      this.captures = new Set();
      this.classList = { add() {}, remove() {} };
    }
    appendChild(child) { this.children.push(child); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) {
      this.captures.delete(id);
      this.emit('lostpointercapture', { pointerId: id });
    }
    emit(type, overrides = {}) {
      this.listeners[type]?.({
        type, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        button: 0, clientX: 280, clientY: 200, preventDefault() {}, ...overrides,
      });
    }
  }
  const document = {
    body: new Element(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement: () => new Element(),
    createElementNS: () => new Element(),
  };
  const context = vm.createContext({
    document, alert() {},
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  let source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.html')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(source, context);
  const inner = file.endsWith('.html') ? elements.get('inner') : elements.get('wheel').children[1];
  return { inner, document, context, timers, elements };
}

for (const file of ['script.js', '観覧車.html']) {
  test(`${file}: mouse click advances one step; right click and hover do not`, () => {
    const { inner } = load(file);
    inner.emit('pointermove', { clientX: 200, clientY: 280 });
    inner.emit('pointerdown', { button: 2 });
    inner.emit('pointerup', { button: 2 });
    assert.equal(inner.attributes.transform, file.endsWith('.html') ? undefined : 'rotate(0)');
    inner.emit('pointerdown');
    inner.emit('pointerup');
    assert.equal(inner.attributes.transform, 'rotate(60)');
    assert.equal(inner.captures.size, 0);
    inner.emit('pointerdown');
    inner.emit('pointerup');
    assert.equal(inner.attributes.transform, 'rotate(120)');
  });

  for (const pointerType of ['mouse', 'touch']) {
    test(`${file}: ${pointerType} drag snaps without an extra step`, () => {
      const { inner } = load(file);
      inner.emit('pointerdown', { pointerType });
      inner.emit('pointermove', { pointerType, clientX: 200, clientY: 280 });
      inner.emit('pointerup', { pointerType, clientX: 200, clientY: 280 });
      assert.equal(inner.attributes.transform, 'rotate(120)');
      inner.emit('pointermove', { pointerType });
      assert.equal(inner.attributes.transform, 'rotate(120)');
    });
  }

  test(`${file}: touch tap, secondary pointer and cancellation do not advance`, () => {
    const { inner } = load(file);
    inner.emit('pointerdown', { pointerType: 'touch' });
    inner.emit('pointermove', { pointerId: 2, clientX: 200, clientY: 280 });
    inner.emit('pointerup', { pointerType: 'touch' });
    assert.equal(inner.attributes.transform, 'rotate(0)');
    for (const type of ['pointercancel', 'lostpointercapture']) {
      inner.emit('pointerdown');
      inner.emit(type);
      assert.equal(inner.attributes.transform, 'rotate(0)');
      inner.emit('pointerup');
      assert.equal(inner.attributes.transform, 'rotate(0)');
    }
  });
}

test('mouse and touch long press open settings; release/cancel clear the timer', () => {
  for (const pointerType of ['mouse', 'touch']) {
    const { document, elements, timers } = load('script.js');
    const button = document.body.children[0];
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.emit('pointerdown', { pointerType });
      assert.equal(timers.size, 1);
      button.emit(type, { pointerType });
      assert.equal(timers.size, 0);
    }
    button.emit('pointerdown', { pointerType });
    for (const callback of timers.values()) callback();
    assert.equal(elements.get('adminPanel').style.display, 'flex');
    button.emit('pointerup', { pointerType });
    elements.get('closeBtn').onclick();
    assert.equal(elements.get('adminPanel').style.display, 'none');
  }
});

test('click uses the selected division after applying settings', () => {
  for (const division of [4, 6, 8]) {
    const { inner, document, elements } = load('script.js');
    document.getElementById('division').value = String(division);
    document.getElementById('outerInput').value = Array(division).fill('🍎').join(',');
    document.getElementById('innerInput').value = Array(division).fill('🐶').join(',');
    elements.get('applyBtn').onclick();
    inner.emit('pointerdown');
    inner.emit('pointerup');
    assert.equal(inner.attributes.transform, `rotate(${360 / division})`);
  }
});
