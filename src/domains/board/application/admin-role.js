import { isSiteAdminEmail as isAdminEmail } from '../../auth/domain/access-policy.js';

function resolveBoardRole({ user, profile } = {}) {
  if (profile && profile.role === "admin") return "admin";
  if (isAdminEmail(user && user.email)) return "admin";
  return (profile && profile.role) || "free";
}

function shouldShowNoticeCategory({ role, initialCategory } = {}) {
  return role === "admin" || initialCategory === "notice";
}

export { isAdminEmail, resolveBoardRole, shouldShowNoticeCategory };
