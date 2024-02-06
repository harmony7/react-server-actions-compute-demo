"use strict";

const React = require("react");
const ReactServerDOMServer = require("react-server-dom-webpack/server");

const { App } = require("./app/app.jsx");

function renderApp(returnValue, formState, clientModuleMap) {
  const payload = {
    root: React.createElement(App),
    returnValue,
    formState,
  };

  return ReactServerDOMServer.renderToReadableStream(payload, clientModuleMap);
}

function decodeReply(body, serverModuleMap) {
  return ReactServerDOMServer.decodeReply(body, serverModuleMap);
}

async function execRscAction(rscAction, args, serverModuleMap) {
  const [url, name] = rscAction.split('#');

  const moduleId = serverModuleMap[url]?.id;

  if (moduleId == null) {
    throw new Error('Module not found');
  }

  // noinspection JSUnresolvedReference
  const module = __webpack_require__(moduleId);

  const action = module[name];

  // Validate that this is actually a function we intended to expose and
  // not the client trying to invoke arbitrary functions. In a real app,
  // you'd have a manifest verifying this before even importing it.
  if (action.$$typeof !== Symbol.for('react.server.reference')) {
    throw new Error('Invalid action');
  }

  const result = action.apply(null, args);

  await result;

  return result;
}

module.exports = {
  renderApp,
  decodeReply,
  execRscAction,
};
