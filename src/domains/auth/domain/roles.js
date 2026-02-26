export const Roles = Object.freeze({
  ADMIN: "admin",
  SUBSCRIBER: "subscriber",
  FREE: "free",
});

export const DEFAULT_ROLE = Roles.FREE;

export function isValidRole(role) {
  return Object.values(Roles).includes(role);
}
