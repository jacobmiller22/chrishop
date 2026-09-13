import { defineCloudflareConfig } from '@opennextjs/cloudflare';

const config = defineCloudflareConfig();

export default {
  ...config,
  functions: {
    admin: {
      routes: [
        'app/(payload)/admin/[[...segments]]/page',
        'app/(payload)/api/[...slug]/route',
        'app/(payload)/api/graphql/route',
      ],
      patterns: ['admin', 'admin/*', 'admin/**', 'api/payload/*', 'api/payload/**', 'api/graphql', 'api/graphql/*'],
      override: {
        wrapper: 'cloudflare-node',
        converter: 'edge',
      },
    },
  },
};
