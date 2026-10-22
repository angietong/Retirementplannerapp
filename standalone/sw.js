/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-bd5fa0a7'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "b6c58328b9efb4ee476d4277de1d81ef"
  }, {
    "url": "pwa-512x512.png",
    "revision": "48abb450012d1328a0fcdd816a332d49"
  }, {
    "url": "pwa-192x192.png",
    "revision": "2170afce667eaff4277081520b2621fd"
  }, {
    "url": "index.html",
    "revision": "994ee7300f717b9c28f2d70b69e10ec5"
  }, {
    "url": "icon.svg",
    "revision": "5a9941e0e5a76d8e358ee9dfdffec381"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "fb86ca2b2ae9d25bf02edcc8e46496ab"
  }, {
    "url": "assets/index-Cf4kpUkA.css",
    "revision": null
  }, {
    "url": "assets/index-CD1-DqMa.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "fb86ca2b2ae9d25bf02edcc8e46496ab"
  }, {
    "url": "icon.svg",
    "revision": "5a9941e0e5a76d8e358ee9dfdffec381"
  }, {
    "url": "pwa-192x192.png",
    "revision": "2170afce667eaff4277081520b2621fd"
  }, {
    "url": "pwa-512x512.png",
    "revision": "48abb450012d1328a0fcdd816a332d49"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "b6c58328b9efb4ee476d4277de1d81ef"
  }, {
    "url": "manifest.webmanifest",
    "revision": "d42d52d2eeedaf4616c491a7925fb7d2"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(({
    request
  }) => request.destination === "document" || request.destination === "script" || request.destination === "style" || request.destination === "image", new workbox.StaleWhileRevalidate({
    "cacheName": "app-runtime-cache",
    plugins: [new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
