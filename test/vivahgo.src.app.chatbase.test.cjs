const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function loadAppModule() {
  return import(`${toFileUrl(appPath('src/chatbase.js'))}?t=${Date.now()}`);
}

async function loadRouteModule() {
  return import(`${toFileUrl(appPath('src/appRoutes.js'))}?t=${Date.now()}`);
}

function setupDom(url = 'http://localhost/') {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url });
  global.window = dom.window;
  global.document = dom.window.document;
  return dom;
}

describe('VivahGo/src/chatbase.js', function () {
  let dom;

  afterEach(function () {
    if (dom) {
      dom.window.close();
    }
    delete global.window;
    delete global.document;
  });

  it('enables chatbase on home and pricing routes only', async function () {
    const appMod = await loadAppModule();
    const routeMod = await loadRouteModule();

    assert.equal(
      appMod.shouldShowChatbaseForRoute(routeMod.getRouteInfo('/', { hostname: 'vivahgo.com' })),
      true
    );
    assert.equal(
      appMod.shouldShowChatbaseForRoute(routeMod.getRouteInfo('/pricing', { hostname: 'vivahgo.com' })),
      true
    );
    assert.equal(
      appMod.shouldShowChatbaseForRoute(routeMod.getRouteInfo('/guides', { hostname: 'vivahgo.com' })),
      false
    );
    assert.equal(
      appMod.shouldShowChatbaseForRoute(routeMod.getRouteInfo('/planner', { hostname: 'localhost' })),
      false
    );
  });

  it('injects the chatbase script immediately once the document is fully loaded', async function () {
    dom = setupDom('http://localhost/');
    const appMod = await loadAppModule();

    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => 'complete',
    });

    const cleanup = appMod.initializeChatbase('chatbase-test-id');
    const script = document.getElementById('chatbase-test-id');

    assert.equal(typeof cleanup, 'undefined');
    assert.ok(script);
    assert.equal(script.tagName, 'SCRIPT');
    assert.match(script.src, /^https:\/\/www\.chatbase\.co\/embed\.min\.js/);
    assert.equal(script.type, 'module');
    assert.equal(script.domain, 'www.chatbase.co');
  });

  it('removes existing chatbase artifacts from the document', async function () {
    dom = setupDom('http://localhost/');
    const appMod = await loadAppModule();

    const script = document.createElement('script');
    script.id = 'chatbase-test-id';
    document.body.appendChild(script);

    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.chatbase.co/frame';
    document.body.appendChild(iframe);

    const widget = document.createElement('div');
    widget.className = 'chatbase-widget-shell';
    document.body.appendChild(widget);

    appMod.removeChatbaseArtifacts('chatbase-test-id');

    assert.equal(document.getElementById('chatbase-test-id'), null);
    assert.equal(document.querySelector('iframe[src*="chatbase.co"]'), null);
    assert.equal(document.querySelector('.chatbase-widget-shell'), null);
  });
});
