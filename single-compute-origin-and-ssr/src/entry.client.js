import rscClient from '@h7/compute-js-rsc/client';

// * CLIENT *
// Hydrate the app. This process uses the flight data in a script tag in the HTML,
// or if it's not present, makes a call to the flight endpoint to obtain it.

if (document.readyState === 'loading') {
  await new Promise(resolve => {
    document.addEventListener("DOMContentLoaded", () => resolve());
  });
}

const flightDataEl = document.getElementById('react-flight-data');

let flightStream;
if (flightDataEl != null) {
  // If flight data already exists in the DOM, then we use it
  flightStream = new Response(flightDataEl.textContent).body;
  flightDataEl.remove();
}

await rscClient.hydrateApp(flightStream);
