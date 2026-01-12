class MockClassList {
  constructor(element) {
    this.element = element;
    this.set = new Set();
  }

  add(...classes) {
    classes.forEach(name => this.set.add(name));
    this._sync();
  }

  remove(...classes) {
    classes.forEach(name => this.set.delete(name));
    this._sync();
  }

  toggle(name, force) {
    if (force === undefined) {
      const shouldAdd = !this.set.has(name);
      if (shouldAdd) {
        this.set.add(name);
      } else {
        this.set.delete(name);
      }
      this._sync();
      return shouldAdd;
    }

    if (force) {
      this.set.add(name);
    } else {
      this.set.delete(name);
    }
    this._sync();
    return force;
  }

  contains(name) {
    return this.set.has(name);
  }

  _sync() {
    this.element._className = Array.from(this.set).join(' ');
  }
}

function parseSelector(selector) {
  const excluded = [];
  const notRegex = /:not\(([^)]+)\)/g;
  let match = notRegex.exec(selector);
  while (match) {
    excluded.push(match[1].trim().replace(/^\./, ''));
    match = notRegex.exec(selector);
  }

  const base = selector.split(':not')[0];
  if (base.startsWith('#')) {
    return { id: base.slice(1), required: [], excluded };
  }

  const required = base
    .split('.')
    .map(part => part.trim())
    .filter(Boolean);

  return { required, excluded };
}

function matchesSelector(element, selector) {
  if (selector.startsWith('#')) {
    const { id } = parseSelector(selector);
    return element.id === id;
  }

  if (!selector.startsWith('.')) {
    return false;
  }

  const { required, excluded } = parseSelector(selector);
  const hasAllRequired = required.every(name => element.classList.contains(name));
  const hasExcluded = excluded.some(name => element.classList.contains(name));
  return hasAllRequired && !hasExcluded;
}

function querySelectorAllFrom(root, selector) {
  const matches = [];
  root.children.forEach(child => {
    if (matchesSelector(child, selector)) {
      matches.push(child);
    }
    matches.push(...querySelectorAllFrom(child, selector));
  });
  return matches;
}

class MockElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this.classList = new MockClassList(this);
    this._className = '';
    this._id = '';
    this._innerHTML = '';
    this.textContent = '';
    this.innerText = '';
    this.scrollHeight = 0;
    this._listeners = new Map();
  }

  set className(value) {
    const classNames = String(value || '')
      .split(/\s+/)
      .filter(Boolean);
    this.classList.set = new Set(classNames);
    this._className = classNames.join(' ');
  }

  get className() {
    return this._className;
  }

  set id(value) {
    this._id = value;
    if (this.ownerDocument && value) {
      this.ownerDocument._elementsById.set(value, this);
    }
  }

  get id() {
    return this._id;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    if (child.parentElement) {
      child.parentElement.removeChild(child);
    }
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  prepend(child) {
    if (child.parentElement) {
      child.parentElement.removeChild(child);
    }
    this.children.unshift(child);
    child.parentElement = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    child.parentElement = null;
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  get lastChild() {
    return this.children[this.children.length - 1] || null;
  }

  querySelectorAll(selector) {
    return querySelectorAllFrom(this, selector);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSelector(current, selector)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  addEventListener(type, handler) {
    const list = this._listeners.get(type) || [];
    list.push(handler);
    this._listeners.set(type, list);
  }

  dispatchEvent(event) {
    const list = this._listeners.get(event.type) || [];
    list.forEach(handler => handler(event));
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 10, height: 10 };
  }
}

class MockDocument {
  constructor() {
    this._elementsById = new Map();
    this.body = new MockElement('body', this);
    this._listeners = new Map();
  }

  createElement(tagName) {
    return new MockElement(tagName, this);
  }

  getElementById(id) {
    return this._elementsById.get(id) || null;
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  addEventListener(type, handler) {
    const list = this._listeners.get(type) || [];
    list.push(handler);
    this._listeners.set(type, list);
  }

  dispatchEvent(event) {
    const list = this._listeners.get(event.type) || [];
    list.forEach(handler => handler(event));
  }

  triggerDOMContentLoaded() {
    this.dispatchEvent({ type: 'DOMContentLoaded' });
  }
}

export class MockResizeObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    MockResizeObserver.instances.push(this);
  }

  observe(element) {
    this.observed.push(element);
  }

  disconnect() {}
}

export function setupMockDom({ includeWindow = true } = {}) {
  const previous = {
    document: global.document,
    window: global.window,
    ResizeObserver: global.ResizeObserver
  };

  const document = new MockDocument();
  global.document = document;

  if (includeWindow) {
    global.window = {
      scrollX: 0,
      scrollY: 0,
      requestAnimationFrame: callback => callback()
    };
  } else {
    delete global.window;
  }

  return {
    document,
    restore: () => {
      if (previous.document === undefined) {
        delete global.document;
      } else {
        global.document = previous.document;
      }

      if (previous.window === undefined) {
        delete global.window;
      } else {
        global.window = previous.window;
      }

      if (previous.ResizeObserver === undefined) {
        delete global.ResizeObserver;
      } else {
        global.ResizeObserver = previous.ResizeObserver;
      }

      MockResizeObserver.instances = [];
    }
  };
}

export function createElement(document, { id, className, parent, tagName = 'div' } = {}) {
  const element = document.createElement(tagName);
  if (id) {
    element.id = id;
  }
  if (className) {
    element.className = className;
  }
  (parent || document.body).appendChild(element);
  return element;
}

export function useImmediateTimers() {
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => {
    fn();
    return 0;
  };

  return () => {
    global.setTimeout = originalSetTimeout;
  };
}
