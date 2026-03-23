const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { appPath, toAbs, toFileUrl } = require('./helpers/testUtils.cjs');

const React = require(toAbs(appPath('node_modules/react')));
const { createRoot } = require(toAbs(appPath('node_modules/react-dom/client')));
const { act } = React;

async function loadHookModule() {
  return import(`${toFileUrl(appPath('src/hooks/useSwipeDown.js'))}?t=${Date.now()}`);
}

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  return dom;
}

function dispatchTouchEvent(target, type, y) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: [{ clientY: y }],
    configurable: true,
  });
  Object.defineProperty(event, 'changedTouches', {
    value: [{ clientY: y }],
    configurable: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe('VivahGo/src/hooks/useSwipeDown.js', function () {
  let dom;

  before(function () {
    global.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(function () {
    if (dom) {
      dom.window.close();
    }
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  after(function () {
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  it('calls onClose for touch swipe past threshold and resets styles', async function () {
    dom = setupDom();
    const mod = await loadHookModule();

    let closeCalls = 0;

    function Test() {
      const { modalProps } = mod.useSwipeDown(() => {
        closeCalls += 1;
      }, 100);
      return React.createElement('div', { id: 'modal', ...modalProps });
    }

    const root = createRoot(document.getElementById('root'));
    await act(async () => {
      root.render(React.createElement(Test));
    });

    const modal = document.getElementById('modal');
    dispatchTouchEvent(modal, 'touchstart', 100);
    dispatchTouchEvent(window, 'touchmove', 230);
    dispatchTouchEvent(window, 'touchend', 230);

    assert.equal(closeCalls, 1);
    assert.equal(modal.style.transform, '');

    await act(async () => {
      root.unmount();
    });
  });

  it('does not close when touch swipe is below threshold', async function () {
    dom = setupDom();
    const mod = await loadHookModule();

    let closeCalls = 0;

    function Test() {
      const { modalProps } = mod.useSwipeDown(() => {
        closeCalls += 1;
      }, 140);
      return React.createElement('div', { id: 'modal', ...modalProps });
    }

    const root = createRoot(document.getElementById('root'));
    await act(async () => {
      root.render(React.createElement(Test));
    });

    const modal = document.getElementById('modal');
    dispatchTouchEvent(modal, 'touchstart', 100);
    dispatchTouchEvent(window, 'touchmove', 170);
    dispatchTouchEvent(window, 'touchend', 170);

    assert.equal(closeCalls, 0);

    await act(async () => {
      root.unmount();
    });
  });

  it('handles mouse gesture close path and ignores form control targets', async function () {
    dom = setupDom();
    const mod = await loadHookModule();

    let closeCalls = 0;

    function Test() {
      const { modalProps } = mod.useSwipeDown(() => {
        closeCalls += 1;
      }, 90);
      return React.createElement('div', { id: 'modal', ...modalProps }, React.createElement('button', { id: 'btn' }, 'x'));
    }

    const root = createRoot(document.getElementById('root'));
    await act(async () => {
      root.render(React.createElement(Test));
    });

    const modal = document.getElementById('modal');
    const button = document.getElementById('btn');

    button.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, clientY: 100 }));
    window.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientY: 250 }));
    window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, clientY: 250 }));
    assert.equal(closeCalls, 0);

    modal.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, clientY: 100 }));
    window.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientY: 220 }));
    window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, clientY: 220 }));

    assert.equal(closeCalls, 1);

    await act(async () => {
      root.unmount();
    });
  });
});
