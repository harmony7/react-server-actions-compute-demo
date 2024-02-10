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
      // The flight stream is needed twice:
      // - Once now to render HTML (purpose A)
      // - Later in the client during app hydration (purpose B)

      // After rendering the HTML (purpose A), we will inject a copy of the flight
      // stream into the HTML body so that the client side code can use it
      // for hydration (purpose B). If we didn't do this, then the client side code would have
      // to make an additional fetch to perform hydration.

      // * SSR *
      // Because a ReadableStream can only be streamed from once, we tee it.

      // TODO: use .tee() when Compute runtime supports it
      // const [ flightStream1, flightStream2 ] = flightStream.tee();
      const [ flightStream1, flightStream2 ] = await new Promise(async resolve => {
        const content = await new Response(flightStream).text();
        resolve([
          new Response(content).body,
          new Response(content).body,
        ]);
      });

      // * SSR *
      // Render the flight stream to HTML (purpose A)
      const renderStream = await ssrBundle.renderFlightStreamToHtmlStream(flightStream1);

      // * SSR *
      // Inject the flight stream data into the HTML stream as a script tag (purpose B)
      const transformedStream = ssrBundle.injectFlightStreamIntoRenderStream(renderStream, flightStream2);

      // * SSR *
      // Return the HTML stream
      return new Response(
        transformedStream, {
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
