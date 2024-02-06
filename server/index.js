/// <reference types="@fastly/js-compute" />

require('./Blob.js');
require('formdata-polyfill');

const backend = require('../build/backend/main.js');
const edge = require('../build/edge/main.js');

const { contentAssets } = require('../static-content/statics');

const CLIENT_MODULE_MAP = JSON.parse(contentAssets.getAsset('/build/client/react-client-manifest.json').getText());
const SERVER_MODULE_MAP = JSON.parse(contentAssets.getAsset('/build/backend/react-server-manifest.json').getText());

/**
 * @param {FetchEvent} event
 */
async function handleRequest(event) {

  const request = event.request;
  const url = new URL(request.url);

  // RSC
  if (url.pathname === '/' || url.pathname === '/index.html') {

    // Result of RSC action
    let result = undefined;
    if (request.method === 'POST') {
      const rscAction = request.headers.get('rsc-action');
      if (rscAction == null) {
        // Progressive enhancement case, but 400 for now
        return new Response('Not supported', { status: 400, headers: { 'Content-Type': 'text/plain' }});
      }

      if (request.headers.get('content-type') === 'multipart/form-data') {
        // Compute doesn't do this natively right now, figure something out
        return new Response('Not supported', { status: 400, headers: { 'Content-Type': 'text/plain' }});
      }

      const args = await backend.decodeReply(await request.text(), SERVER_MODULE_MAP);

      result = await backend.execRscAction(rscAction, args, SERVER_MODULE_MAP);
    }

    const flightStream = backend.renderApp(result, null, CLIENT_MODULE_MAP);

    // If request was for text/html, then we use the ssr library to render the flight stream into HTML
    if (request.headers.get('Accept').includes('text/html')) {

      // Tee the flightStream so that we can render it and also inject its content into the response

      // TODO: use .tee() when Compute runtime supports it
      // const [ flightStream1, flightStream2 ] = flightStream.tee();
      const [ flightStream1, flightStream2 ] = await new Promise(async resolve => {
        const content = await new Response(flightStream).text();
        resolve([
          new Response(content).body,
          new Response(content).body,
        ]);
      });

      // Render the flight stream to HTML
      const renderStream = await edge.renderFlightStream(flightStream1);

      // Inject the flightStream data into the response as a script tag
      const transformedStream = edge.injectFlightStreamIntoRenderStream(renderStream, flightStream2);

      return new Response(
        transformedStream, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          }
        }
      );

    }

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

  if (url.pathname.startsWith('/app/')) {

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
