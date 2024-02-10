/// <reference types="@fastly/js-compute" />

// Polyfills
Object.assign(globalThis, require('blob-polyfill'));
require('formdata-polyfill');
require('@h7/compute-js-formdata');

// "Backend" bundle - contains code to instantiate React root, accept updates via RSC Actions,
// and generate flight stream
const backendBundle = require('../build/backend/main.js');
const { App } = backendBundle;

// "SSR" Bundle - contains code to simulate the frontend and generate HTML during SSR
const ssrBundle = require('../build/ssr/main.js');

const { contentAssets } = require('../static-content/statics');

const CLIENT_MODULE_MAP = JSON.parse(contentAssets.getAsset('/build/client/react-client-manifest.json').getText());
const SERVER_MODULE_MAP = JSON.parse(contentAssets.getAsset('/build/backend/react-server-manifest.json').getText());

/**
 * @param {FetchEvent} event
 */
async function handleRequest(event) {

  const request = event.request;
  const url = new URL(request.url);

  // * SERVER *
  // Handle request to root
  if (url.pathname === '/' || url.pathname === '/index.html') {

    // Result of RSC action
    let result = undefined;

    // * SERVER *
    // Check if this was an RSC action, and handle it
    if (request.method === 'POST') {
      const rscAction = request.headers.get('rsc-action');
      if (rscAction == null) {
        // Progressive enhancement case, but 400 for now
        return new Response('Not supported', { status: 400, headers: { 'Content-Type': 'text/plain' }});
      }

      // * SERVER *
      // The browser will have encoded RSC action name in the rsc-action header, along with
      // the action's arguments in the request body.
      // Make a call to the RSC action, and get the return value.
      result = await backendBundle.execRscAction(rscAction, request, SERVER_MODULE_MAP);
    }

    // * SERVER *
    // We have:
    // - App component (root)
    // - Updated RSC action return value, if any
    // - Updated form state if any
    // Render these into a "flight stream".
    const flightStream = backendBundle.generateFlightStream(App, result, null, CLIENT_MODULE_MAP);

    // * SSR *
    // If request was for text/html, then we perform SSR to render the flight stream
    // into HTML. We do this with the help of our ssr bundle, which simulates client side
    // rendering.
    if (request.headers.get('Accept').includes('text/html')) {

      // * SSR *
      // Render the flight stream to HTML.
      // This HTML also contains a copy of the flight data as a script tag,
      // to be used during hydration.
      const htmlStream = await ssrBundle.renderFlightStreamToHtmlStreamWithFlightData(flightStream);

      // * SSR *
      // Return the HTML stream
      return new Response(
        htmlStream, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          }
        }
      );

    }

    // * SERVER *
    // otherwise, return it directly
    return new Response(
      flightStream,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/x-component',
        },
      },
    );
  }

  // * SERVER *
  // Handle request to asset files
  if (url.pathname.startsWith('/app/')) {

    // * STATIC-PUBLISHER *
    // Use @fastly/compute-js-static-publish to make app bundles available to the browser.
    const bundleName = url.pathname.slice('/app/'.length);
    const asset = contentAssets.getAsset('/build/client/' + bundleName);
    if (asset != null) {
      return new Response(
        asset.getBytes(),
        {
          status: 200,
          headers: {
            'Content-Type': asset.getMetadata().contentType,
          }
        }
      );
    }
  }

  return new Response(
    'Not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
      }
    }
  );
}

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));
