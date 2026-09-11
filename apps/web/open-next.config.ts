import { defineCloudflareConfig } from '@opennextjs/cloudflare';

const config = defineCloudflareConfig();

export default {
  ...config,
  functions: {
    admin: {
      routes: ['app/(payload)/admin/**', 'app/(payload)/api/**'],
      patterns: ['admin/*', 'api/payload/*'],
      override: {
        wrapper: 'cloudflare-node',
        converter: 'edge',
      },
    },
  },
};
