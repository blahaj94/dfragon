// Keep every browser build on static CSP-safe stylesheets without runtime style injection.
// CSS layers stay off so StyleX rules and the global token and foundation CSS keep plain cascade order.
export const stylexOptions = {
  runtimeInjection: false,
  useCSSLayers: false
}
