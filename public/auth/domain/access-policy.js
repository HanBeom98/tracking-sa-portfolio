// These scopes intentionally differ. Do not promote league staff to site admins.
export const PROFILE_ADMIN_EMAILS = Object.freeze(['demo-e63e3a1b@example.com']);
export const SITE_ADMIN_EMAILS = Object.freeze([...PROFILE_ADMIN_EMAILS, 'demo-9249b6f9@example.com']);
export const SA_MODERATOR_EMAILS = Object.freeze([
  'demo-c9c4b555@example.com', 'demo-932eccd8@example.com', 'demo-731cb71f@example.com',
]);
export const SA_STAFF_EMAILS = Object.freeze([...SITE_ADMIN_EMAILS, ...SA_MODERATOR_EMAILS]);

export function normalizeAccessEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isSiteAdminEmail(email) {
  return SITE_ADMIN_EMAILS.includes(normalizeAccessEmail(email));
}

// A site administrator is distinct from a league-only moderator. The profile
// comes from the settled auth gateway; database rules remain authoritative.
export function isSiteAdministrator(user, profile) {
  return Boolean(user?.uid && (isSiteAdminEmail(user.email)
    || profile?.role === 'admin' && (!profile.uid || profile.uid === user.uid)));
}
