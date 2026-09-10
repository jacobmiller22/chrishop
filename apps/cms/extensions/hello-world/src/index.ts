import { defineHook } from '@directus/extensions-sdk';

export default defineHook(({ action, filter, init }) => {
  init('app.after', () => {
    console.log('[chrishop-extension] Hello World hook hot-reloaded successfully!');
  });

  filter('items.create', (payload) => {
    console.log('[chrishop-extension] Hook filter items.create triggered');
    return payload;
  });

  action('items.create', () => {
    console.log('[chrishop-extension] Hook action items.create triggered');
  });
});
