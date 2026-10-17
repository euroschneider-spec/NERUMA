import { describe, it, expect } from 'vitest';
import { isOrganisationRole, landingPath, type Viewer } from '@/lib/roles';

const viewer=(overrides:Partial<Viewer>={}):Viewer=>({isPlatformAdmin:false,memberships:[],...overrides});
const membership={organisation:'org-1',name:'Willow Museum',role:'admin'} as const;

describe('isOrganisationRole', () => {
  it('accepts the roles the application models', () => {
    expect(isOrganisationRole('owner')).toBe(true);
    expect(isOrganisationRole('admin')).toBe(true);
  });
  it('rejects database roles the application no longer models', () => {
    expect(isOrganisationRole('editor')).toBe(false);
    expect(isOrganisationRole('assessor')).toBe(false);
    expect(isOrganisationRole('reviewer')).toBe(false);
  });
  it('rejects values that are not roles at all', () => {
    expect(isOrganisationRole(undefined)).toBe(false);
    expect(isOrganisationRole('')).toBe(false);
  });
});

describe('landingPath', () => {
  it('sends a platform administrator to the administration dashboard', () => {
    expect(landingPath(viewer({isPlatformAdmin:true}),'en')).toBe('/en/admin');
  });
  it('prefers the platform tier over an organisation membership', () => {
    expect(landingPath(viewer({isPlatformAdmin:true,memberships:[membership]}),'en')).toBe('/en/admin');
  });
  it('sends an organisation member to the workspace', () => {
    expect(landingPath(viewer({memberships:[membership]}),'ro')).toBe('/ro/workspace');
  });
  it('sends an account without memberships to the account page', () => {
    expect(landingPath(viewer(),'de')).toBe('/de/account');
  });
});
