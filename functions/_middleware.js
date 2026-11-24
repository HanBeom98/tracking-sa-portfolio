import { onRequest as discordInteraction } from './api/discord-interaction.js';

// Pages yields the root middleware before scanning every API route. Dispatch
// this fixed endpoint through its existing signed ingress without rebuilding
// matchers for unrelated routes. All other requests use normal Pages routing.
export function onRequest(context) {
  if (new URL(context.request.url).pathname === '/api/discord-interaction') {
    return discordInteraction(context);
  }
  return context.next();
}
