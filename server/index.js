/// <reference types="@fastly/js-compute" />

// Polyfills
import './polyfills.js';

// "Origin" bundle - includes a copy of React, the Server Components for the app, and the RSC Origin library.
import { React, App, rscOrigin, setServerState } from '../build/origin/main.js';

// "SSR" Bundle - contains code to simulate the frontend and generate HTML during SSR
import { rscSsr } from '../build/ssr/main.js';

// "Content Assets" - static files to be either loaded or served
import { contentAssets } from '../static-content/statics.js';

// Origin module needs to be set up with asset module maps
rscOrigin.setModuleMaps({
  clientModuleMap: contentAssets.getAsset('/build/client/react-client-manifest.json').getJson(),
  serverModuleMap: contentAssets.getAsset('/build/origin/react-server-manifest.json').getJson(),
});

// Entry point manifest needed for SSR of landing page
const { js: mainJSChunks, css: mainCSSChunks } = contentAssets.getAsset('/build/client/entrypoint-manifest.json').getJson().main;

/**
 * @param {FetchEvent} event
 */
async function handleRequest(event) {

  const request = event.request;
  const url = new URL(request.url);

  // * ORIGIN *
  // Handle request to root
  if (url.pathname === '/' || url.pathname === '/index.html') {

    // Result of RSC action
    let returnValue = null;

    // Form state
    let formState = null;

    // * ORIGIN *
    // Check if this was an RSC action, and handle it
    if (request.method === 'POST') {

      // The browser will have encoded RSC action name in the rsc-action header
      const rscAction = request.headers.get('rsc-action');
      if (rscAction != null) {

        // The action's arguments will be in the request body.
        let rscArgs;
        const contentType = request.headers.get('Content-Type');
        if (contentType?.startsWith('multipart/form-data;')) {
          rscArgs = await request.formData();
        } else {
          rscArgs = await request.text();
        }

        try {
          // Make a call to the RSC action, and get the return value.
          returnValue = await rscOrigin.execRscAction(rscAction, rscArgs);
        } catch(ex) {
          console.error(ex);
          throw ex;
        }

      } else {

        // If an RSC <form> was submitted before React was able to hook it, then we run
        // in "Progressive enhancement" mode.
        try {
          formState = await rscOrigin.execRscFormAction(request);
        } catch (ex) {
          formState = null;
          await setServerState('Error: ' + ex.message);
        }

      }
    }

    // * ORIGIN *
    // Instantiate App
    const app = React.createElement(App);

    // * ORIGIN *
    // We have:
    // - App component (root)
    // - Updated RSC action return value, if any
    // - Updated form state if any
    // Render these into a "flight stream".
    const flightStream = rscOrigin.generateFlightStream(
      app,
      returnValue,
      formState,
    );

    // * ORIGIN *
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
    const [ flightStream1, flightStream2 ] = flightStream.tee();

    // * SSR *
    // Render the flight stream to HTML.
    const htmlStream = await rscSsr.renderFlightStreamToHtmlStream(
      flightStream1,
      mainJSChunks.map(chunk => '/app/' + chunk),
    );

    // Create a new stream that injects the flight stream at the end
    const htmlStreamWithFlight = new ReadableStream({
      htmlStreamReader: null,
      encoder: null,
      decoder: null,
      alreadyInjected: false,
      async start() {
        this.htmlStreamReader = htmlStream.getReader()
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
        this.alreadyInjected = false;
      },
      async pull(controller) {
        let result = await this.htmlStreamReader.read();

        if (result.done) {
          if (!this.alreadyInjected) {
            await this.injectFlightStream(controller);
          }
          controller.close();
          return
        }

        const chunk = result.value;
        if (this.alreadyInjected) {
          controller.enqueue(chunk);
          return;
        }

        const value = this.decoder.decode(result.value);

        // Insert right before ending body tag
        const pos = value.indexOf('</body>');
        if (pos === -1) {
          controller.enqueue(chunk);
          return;
        }

        const before = value.slice(0, pos);
        const after = value.slice(pos);

        controller.enqueue(this.encoder.encode(before));
        await this.injectFlightStream(controller);
        controller.enqueue(this.encoder.encode(after));
        this.alreadyInjected = true;
      },
      async injectFlightStream(controller) {
        // Build a script tag of the flight stream to be appended to the HTML stream.
        controller.enqueue(new TextEncoder().encode(`<script id="react-flight-data" type="react/flight">`));
        const reader = flightStream2.getReader();
        while (true) {
          const result = await reader.read();
          if (result.done) {
            break;
          }
          controller.enqueue(result.value);
        }
        controller.enqueue(new TextEncoder().encode(`</script>`));
      }
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

  // * ORIGIN *
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
