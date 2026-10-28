// Org roles and their UI names. Platform admin is not an org role (`platform_admins` table).
import type { OrgRole } from '#lib/supabase/types.js';

export const ORG_ROLES: readonly OrgRole[] = ['member', 'admin'];

export const ROLE_LABELS: Record<OrgRole, string> = { admin: 'Org admin', member: 'Member' };
