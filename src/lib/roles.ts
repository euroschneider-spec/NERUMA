import type { Locale } from './i18n';
export type OrganisationRole='owner'|'admin';
export const roleDescriptions:Record<Locale,Record<OrganisationRole,string>>={
 en:{owner:'Manage members and all organisation locations.',admin:'Manage locations, review content and publish guides.'},
 ro:{owner:'Gestionează membrii și toate locațiile organizației.',admin:'Gestionează locațiile, verifică și publică ghiduri.'},
 de:{owner:'Mitglieder und alle Standorte verwalten.',admin:'Standorte und Inhalte verwalten, Guides veröffentlichen.'}
};

// The database enum still carries editor, assessor and reviewer, so a membership row may hold a
// role this application does not model. Such rows are dropped rather than assumed harmless.
export const isOrganisationRole=(value:unknown):value is OrganisationRole=>value==='owner' || value==='admin';

// Platform administration is a separate tier from organisation membership: it lives in
// private.platform_admins and is read through is_platform_admin(), never from user metadata,
// which the account holder can edit themselves.
export type Membership={organisation:string;name:string;role:OrganisationRole};
export type Viewer={isPlatformAdmin:boolean;memberships:Membership[]};

// A platform administrator signing in is there to run the platform, so that tier wins over
// any organisation membership the same account also holds.
export function landingPath(viewer:Viewer,locale:Locale) {
  if(viewer.isPlatformAdmin) return `/${locale}/admin`;
  if(viewer.memberships.length) return `/${locale}/workspace`;
  return `/${locale}/account`;
}
