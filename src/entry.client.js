const React = require("react");
const ReactDOMClient = require("react-dom/client");
const ReactServerDOMClient = require("react-server-dom-webpack/client");

// Client-side "Shell" component.
// Allows the use of "updateRoot" function to update the component tree.
let updateRoot;
function Shell({data}) {
  const [root, setRoot] = React.useState(data);
  updateRoot = setRoot;
  return root;
}

async function callServer(actionId, args) {

  const response = fetch('/', {
    method: 'POST',
    headers: {
      Accept: 'text/x-component',
      'rsc-action': actionId,
    },
    body: await ReactServerDOMClient.encodeReply(args),
  });

  const { returnValue, root } = await ReactServerDOMClient.createFromFetch(
    response,
    {
      callServer,
    }
  );

  React.startTransition(() => {
    updateRoot(root);
  });

  return returnValue;
}

async function hydrateApp() {
  const flightDataEl = document.getElementById('react-flight-data');

  let flightResponse;
  if (flightDataEl != null) {
    // If flight data already exists in the DOM, then we use it
    flightResponse = Promise.resolve(new Response(flightDataEl.textContent));
    flightDataEl.remove();
  } else {
    // Fetch flight data from backend
    flightResponse = fetch('/', {
      headers: {
        Accept: 'text/x-component',
      },
    });
  }

  const { root, formState } = await ReactServerDOMClient.createFromFetch(
    flightResponse,
    {
      callServer,
    }
  );

  ReactDOMClient.hydrateRoot(document, <Shell data={root} />, {
    // TODO: This part doesn't actually work because the server only returns
    // form state during the request that submitted the form. Which means it
    // the state needs to be transported as part of the HTML stream. We intend
    // to add a feature to Fizz for this, but for now it's up to the
    // meta framework to implement correctly.
    formState: formState,
  });
}

// noinspection JSIgnoredPromiseFromCall
hydrateApp();
