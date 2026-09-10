import type { CollectionConfig } from 'payload';

/**
 * Users Collection Schema
 *
 * Payload CMS administrative accounts with authentication.
 * Conforms to HLD Section 3.1 & 4.1, DEP_PAYLOAD_CMS.md, and Story 2.18.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'createdAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    // Default email and password fields are managed natively by auth: true
  ],
};
