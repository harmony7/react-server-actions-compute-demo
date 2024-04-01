/// <reference types="@fastly/js-compute" />

// Polyfills
import './polyfills.js';

// "Backend" bundle - includes a copy of React, the server components for the app, and the RSC Backend library.
import { React, App, rscBackend } from '../build/backend/main.js';

// "SSR" Bundle - contains code to simulate the frontend and generate HTML during SSR
import { rscSsr } from '../build/ssr/main.js';

// "Content Assets" - static files to be either loaded or served
import { contentAssets } from '../static-content/statics.js';

// Backend module needs to be set up with asset module maps
rscBackend.setModuleMaps({
  clientModuleMap: contentAssets.getAsset('/build/client/react-client-manifest.json').getJson(),
  serverModuleMap: contentAssets.getAsset('/build/backend/react-server-manifest.json').getJson(),
});

// Entry point manifest needed for SSR of landing page
const { js: mainJSChunks, css: mainCSSChunks } = contentAssets.getAsset('/build/client/entrypoint-manifest.json').getJson().main;

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
    let returnValue = undefined;

    // * SERVER *
    // Check if this was an RSC action, and handle it
    if (request.method === 'POST') {
      // The browser will have encoded RSC action name in the rsc-action header
      const rscAction = request.headers.get('rsc-action');
      if (rscAction == null) {
        // Progressive enhancement case, but 400 for now
        return new Response('Not supported', { status: 400, headers: { 'Content-Type': 'text/plain' }});
      }

      // The action's arguments will be in the request body.
      let rscArgs;
      const contentType = request.headers.get('Content-Type');
      if (contentType?.startsWith('multipart/form-data;')) {
        rscArgs = await request.formData();
      } else {
        rscArgs = await request.text();
      }

      // Make a call to the RSC action, and get the return value.
      returnValue = await rscBackend.execRscAction(rscAction, rscArgs);
    }

    // * SERVER *
    // Call 'createReactElement', which is just React.createElement exported from the backend bundle. It's important to use that copy of React,
    // since it will be used to generate the flight stream.
    const app = React.createElement(App);

    // * SERVER *
    // We have:
    // - App component (root)
    // - Updated RSC action return value, if any
    // - Updated form state if any
    // Render these into a "flight stream".
    const flightStream = rscBackend.generateFlightStream(
      app,
      returnValue,
      null, /* will be set in progressive enhancement case */
    );

    // * SERVER *
    // If request was for text/x-component, then we return the flight stream directly.
    if (request.headers.get('Accept').includes('text/x-component')) {
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

    // * SSR *
    // Perform SSR to render the flight stream into HTML.
    // We do this with the help of our ssr bundle, which simulates client side rendering.

    // TODO: When @fastly/js-compute implements ReadableStream.prototype.tee(),
    // we can use it to save buffering the entire flight stream to memory
    const flightStreamString = await new Response(flightStream).text();
    const flightStream1 = new Response(flightStreamString).body;

    // * SSR *
    // Render the flight stream to HTML.
    const htmlStream = await rscSsr.renderFlightStreamToHtmlStream(
      flightStream1,
      mainJSChunks.map(chunk => '/app/' + chunk),
    );

    // Build a script tag of the flight stream to be appended to the HTML stream.
    const scriptTag = `<script id="react-flight-data" type="react/flight">${flightStreamString}</script>`;

    // Stream the two in succession to the response
    const htmlStreamWithFlight = new ReadableStream({
      htmlStreamReader: null,
      async start() {
        this.htmlStreamReader = htmlStream.getReader();
      },
      async pull(controller) {
        let result = await this.htmlStreamReader.read();
        if (result.done) {
          controller.enqueue(new TextEncoder().encode(scriptTag));
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      },
    });

    // * SSR *
    // Return the HTML stream
    return new Response(
      htmlStreamWithFlight, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        }
      }
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
