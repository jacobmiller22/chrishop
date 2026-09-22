/**
 * Payload CMS Role-Based Access Control (RBAC) & Permission Engine
 *
 * Implements granular role checks (Admin vs Editor) and mandatory 2FA enforcement
 * for Payload CMS collections, globals, and the administrative dashboard.
 *
 * Conforms to docs/HIGH_LEVEL_DESIGN.md Section 7 and Story 5.2.
 */

import type { Access, FieldAccess, PayloadRequest } from 'payload';
import { verifyAdminSession2FA } from '../lib/payload-2fa';

export type UserRole = 'admin' | 'editor';

export interface AuthUser {
  id?: string | number;
  email?: string;
  roles?: UserRole[] | string[];
  role?: UserRole | string;
  totpEnabled?: boolean;
  totpSecret?: string;
  [key: string]: any;
}

/**
 * Returns true if the user possesses the 'admin' role.
 */
export function checkIsAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (Array.isArray(user.roles)) {
    return user.roles.includes('admin');
  }
  return user.role === 'admin';
}

/**
 * Returns true if the user possesses the 'editor' role.
 */
export function checkIsEditor(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (Array.isArray(user.roles)) {
    return user.roles.includes('editor');
  }
  return user.role === 'editor';
}

/**
 * Returns true if the user is either an Admin or an Editor.
 */
export function checkIsAdminOrEditor(user: AuthUser | null | undefined): boolean {
  return checkIsAdmin(user) || checkIsEditor(user);
}

/**
 * Collection Access: Only Admins have full access.
 */
export const isAdmin: Access = ({ req: { user } }) => {
  return checkIsAdmin(user as AuthUser);
};

/**
 * Collection Access: Only Editors have access.
 */
export const isEditor: Access = ({ req: { user } }) => {
  return checkIsEditor(user as AuthUser);
};

/**
 * Collection Access: Both Admins and Editors have access.
 */
export const isAdminOrEditor: Access = ({ req: { user } }) => {
  return checkIsAdminOrEditor(user as AuthUser);
};

/**
 * Collection Access: Admins can access all records; non-admins can only access their own user document.
 */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (checkIsAdmin(user as AuthUser)) {
    return true;
  }
  return {
    id: {
      equals: user.id,
    },
  };
};

/**
 * Field Access: Only Admins can view or mutate sensitive administrative fields.
 */
export const adminOnlyField: FieldAccess = ({ req: { user } }) => {
  return checkIsAdmin(user as AuthUser);
};

/**
 * Content Collection Write Access (create / update):
 * Both Admins and Editors are allowed to create and edit catalog content.
 */
export const isEditorialWriteAllowed: Access = ({ req: { user } }) => {
  return checkIsAdminOrEditor(user as AuthUser);
};

/**
 * Content Collection Delete Access:
 * Editors CANNOT delete catalog records or content blocks; only Admins can delete.
 */
export const isEditorialDeleteAllowed: Access = ({ req: { user } }) => {
  return checkIsAdmin(user as AuthUser);
};

/**
 * Admin Panel Gate (`access.admin` on Users collection):
 * - Unauthenticated users: denied.
 * - Non-staff roles: denied.
 * - Editors: granted access (restricted to editorial collections).
 * - Admins: MANDATORY TOTP 2FA required. Denied unless session or request carries verified 2FA token/code.
 */
export const canAccessAdminPanel: ({
  req,
}: {
  req: PayloadRequest;
}) => boolean | Promise<boolean> = async ({ req }) => {
  const user = req.user as AuthUser | undefined;
  if (!user) {
    return false;
  }

  const userIsAdmin = checkIsAdmin(user);
  const userIsEditor = checkIsEditor(user);

  if (!userIsAdmin && !userIsEditor) {
    return false;
  }

  // Editors have access to /admin UI without mandatory 2FA
  if (!userIsAdmin && userIsEditor) {
    return true;
  }

  // Admins REQUIRE mandatory TOTP 2FA
  return verifyAdminSession2FA(req, user);
};
