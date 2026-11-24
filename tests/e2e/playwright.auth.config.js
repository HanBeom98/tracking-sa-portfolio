import local from "./playwright.ci.config.js";
export default { ...local, testMatch: "local-auth.spec.js", timeout: 60000 };
