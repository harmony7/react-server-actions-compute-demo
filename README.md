## React Server Components (RSC) Demo for Fastly Compute

by Katsuyuki Omuro (komuro@fastly.com)

1. Edge app ("global" in flight demo)
   * Serves public (/app/) files
   * proxies requests to the origin app and retrieves flight stream
   * if accept is for text/html then renders flight stream to html (SSR Bundle)
     * (SSR Manifest not needed for Edge because entire bundle is loaded already)
     * (Entrypoint Manifest is needed to tell SSR client where JS files are)

2. Origin app ("region" in flight demo)
   * Responds to API endpoints
   * Responds to GET and RSC (POST) 
   * Uses client manifest and server manifest to render the app

3. Client app
   * This is the client bundle
   * Hydrates based on flight stream
