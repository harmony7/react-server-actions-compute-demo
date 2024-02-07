const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ReactServerDOMClient = require("react-server-dom-webpack/client");

// * SSR *
// "Shell" component used during SSR
// The 'use' hook works with ReactDOMServer.renderToReadableStream,
// waiting for the promise to resolve to the React root
function Shell({root}) {
  return React.use(root);
}

// * SSR *
// Parses the flight stream, and updates passed-in formState object
async function parseFlightStream(rscFlightStream, formState) {

  const { root, formState: flightFormState } = await ReactServerDOMClient.createFromReadableStream(rscFlightStream);
  // We shouldn't be assuming formState is an object type but at the moment
  // we have no way of setting the form state from within the render
  Object.assign(formState, flightFormState);

  return root;

}

// * SSR *
// Renders the flight stream into HTML
async function renderFlightStream(flightStream) {

  const formState = [];
  const root = parseFlightStream(flightStream, formState);

  // noinspection JSCheckFunctionSignatures
  const model = React.createElement(Shell, { root });

  return await ReactDOMServer.renderToReadableStream(
    model,
    {
      bootstrapScripts: [
        '/app/runtime.js',
        '/app/main.js',
      ],
      formState,
    }
  );

}

// * SSR *
// A utility "transform stream" that is used to inject a copy of the flight stream into
// the HTML stream as a script tag.
class FlightStreamInjectionTransform extends TransformStream {
  static decoder = new TextDecoder();
  static encoder = new TextEncoder();
  constructor(flightStream) {
    let alreadyInjected = false;

    const transformer = {
      async transform(chunk, controller) {
        if (!(chunk instanceof Uint8Array)) {
          // Guard anyway in case someone uses this TransformStream with an unexpected stream type
          throw new Error('Received non-Uint8Array chunk');
        }
        if (alreadyInjected) {
          controller.enqueue(chunk);
          return;
        }

        const textChunk = FlightStreamInjectionTransform.decoder.decode(chunk);
        const closingHeadPos = textChunk.indexOf('</head>');
        if (closingHeadPos === -1) {
          controller.enqueue(chunk);
          return;
        }

        function enqueueString(stringChunk) {
          controller.enqueue(FlightStreamInjectionTransform.encoder.encode(stringChunk));
        }
        enqueueString(
          textChunk.slice(0, closingHeadPos)
        );
        enqueueString(
          `<script id="react-flight-data" type="react/flight">`
        );
        // TODO: Use an async iterator when Compute runtime gets support
        await new Promise(async resolve => {
          const reader = flightStream.getReader();
          while(true) {
            const {done, value} = await reader.read();
            if (done) {
              resolve();
              break;
            }
            controller.enqueue(value);
          }
        });
        enqueueString(
          `</script>`
        );
        enqueueString(
          textChunk.slice(closingHeadPos)
        );
        alreadyInjected = true;
      },
    };
    super(transformer);
  }
}

// * SSR *
// Inject the flight stream into the HTML stream as a script tag.
function injectFlightStreamIntoRenderStream(renderStream, flightStream) {
  return renderStream.pipeThrough(new FlightStreamInjectionTransform(flightStream));
}

module.exports = {
  renderFlightStream,
  injectFlightStreamIntoRenderStream,
};
