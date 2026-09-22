import type { CollectionConfig } from 'payload';
import {
  adminOnlyField,
  canAccessAdminPanel,
  isAdmin,
  isAdminOrSelf,
} from '../access';

/**
 * Users Collection Schema
 *
 * Payload CMS administrative and staff accounts with Role-Based Access Control (RBAC)
 * and Mandatory TOTP Two-Factor Authentication (2FA) for Admin accounts.
 *
 * Conforms to HLD Section 7, DEP_PAYLOAD_CMS.md, and Story 5.2.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'roles', 'totpEnabled', 'createdAt'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['editor'],
      required: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
      },
      saveToJWT: true,
      admin: {
        description:
          'Role-Based Access Control: Admin has full access with mandatory 2FA; Editor has restricted catalog access.',
      },
    },
    {
      name: 'totpEnabled',
      type: 'checkbox',
      defaultValue: false,
      access: {
        read: () => true,
        update: adminOnlyField,
      },
      saveToJWT: true,
      admin: {
        description: 'Indicates whether TOTP Two-Factor Authentication is enrolled and active.',
      },
    },
    {
      name: 'totpSecret',
      type: 'text',
      admin: {
        hidden: true,
      },
      access: {
        read: adminOnlyField,
        update: adminOnlyField,
      },
    },
    {
      name: 'totpVerifiedAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
      access: {
        read: () => true,
        update: adminOnlyField,
      },
    },
    {
      name: 'totpBackupCodes',
      type: 'json',
      admin: {
        hidden: true,
      },
      access: {
        read: adminOnlyField,
        update: adminOnlyField,
      },
    },
  ],
};
