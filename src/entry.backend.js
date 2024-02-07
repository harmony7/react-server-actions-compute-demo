"use strict";

const React = require("react");
const ReactServerDOMServer = require("react-server-dom-webpack/server");

const { App } = require("./app/app.jsx");

// * SERVER *
// Takes the passed-in return value and form state, and generates a flight stream.
function generateFlightStream(rootComponent, returnValue, formState, clientModuleMap) {
  const payload = {
    root: React.createElement(rootComponent),
    returnValue,
    formState,
  };

  return ReactServerDOMServer.renderToReadableStream(payload, clientModuleMap);
}

// * SERVER *
// Performs an RSC action call and returns the result.
async function execRscAction(rscAction, body, serverModuleMap) {

  // Find the module and action based on the rscAction value
  const [url, name] = rscAction.split('#');
  const moduleId = serverModuleMap[url]?.id;
  if (moduleId == null) {
    throw new Error('Module not found');
  }

  // noinspection JSUnresolvedReference
  const module = __webpack_require__(moduleId);
  const action = module[name];

  // Validate that this is actually a function we intended to expose and
  // not the client trying to invoke arbitrary functions.
  if (action.$$typeof !== Symbol.for('react.server.reference')) {
    throw new Error('Invalid action');
  }

  // Decode the args from the request body.
  // TODO: handle 'multipart/form-data'
  const args = await ReactServerDOMServer.decodeReply(body, serverModuleMap);

  // Make the function call
  const result = action.apply(null, args);

  try {
    // Wait for any mutations
    await result;
  } catch (x) {
    // We handle the error on the client
  }

  return result;
}

module.exports = {
  App,
  generateFlightStream,
  execRscAction,
};
