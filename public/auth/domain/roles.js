export const Roles = Object.freeze({
  ADMIN: "admin",
  SUBSCRIBER: "subscriber",
  FREE: "free",
});

export const DEFAULT_ROLE = Roles.FREE;

export { PROFILE_ADMIN_EMAILS as ADMIN_EMAILS } from './access-policy.js?v=0d740c688852';
