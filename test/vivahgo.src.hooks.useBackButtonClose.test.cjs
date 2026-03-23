const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { appPath, toAbs, toFileUrl } = require('./helpers/testUtils.cjs');

const React = require(toAbs(appPath('node_modules/react')));
const { createRoot } = require(toAbs(appPath('node_modules/react-dom/client')));
const { act } = React;

async function loadHookModule() {
  return import(`${toFileUrl(appPath('src/hooks/useBackButtonClose.js'))}?t=${Date.now()}`);
}

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.history = dom.window.history;
  return dom;
}

describe('VivahGo/src/hooks/useBackButtonClose.js', function () {
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
    delete global.history;
  });

  after(function () {
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  it('triggers onClose on popstate while open and stops after unmount', async function () {
    dom = setupDom();
    const mod = await loadHookModule();

    let closeCalls = 0;

    function Test({ isOpen }) {
      mod.useBackButtonClose(isOpen, () => {
        closeCalls += 1;
      });
      return React.createElement('div');
    }

    const root = createRoot(document.getElementById('root'));
    await act(async () => {
      root.render(React.createElement(Test, { isOpen: true }));
    });

    window.dispatchEvent(new window.PopStateEvent('popstate'));
    assert.equal(closeCalls, 1);

    await act(async () => {
      root.unmount();
    });

    window.dispatchEvent(new window.PopStateEvent('popstate'));
    assert.equal(closeCalls, 1);
  });

  it('uses latest onClose callback reference after rerender', async function () {
    dom = setupDom();
    const mod = await loadHookModule();

    let first = 0;
    let second = 0;

    function Test({ onClose }) {
      mod.useBackButtonClose(true, onClose);
      return React.createElement('div');
    }

    const root = createRoot(document.getElementById('root'));
    await act(async () => {
      root.render(React.createElement(Test, { onClose: () => { first += 1; } }));
    });

    await act(async () => {
      root.render(React.createElement(Test, { onClose: () => { second += 1; } }));
    });

    window.dispatchEvent(new window.PopStateEvent('popstate'));

    assert.equal(first, 0);
    assert.equal(second, 1);
  });
});
