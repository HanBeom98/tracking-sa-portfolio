const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { createReplayCoachingHandler } = require("./replay-coaching-service.js");
const { createReplayReviewHandler } = require("./replay-coaching-review-service.js");
const { createMerchantTestHandler } = require("./replay-coaching-merchant-test.js");
const { createTossPayTestClient } = require("./replay-coaching-tosspay.js");
const { createReplayProductionPurchaseHandler } = require("./replay-coaching-production-purchase.js");
const { onRequest } = require("firebase-functions/v2/https");
const { createDiscordSessionHandler } = require("./discord-session-service.js");
// Discord Ed25519 verification keys are public identifiers, not credentials.
const discordSessionConfig = require("./discord-session-config.cjs");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");

initializeApp();

// Dormant production composition. Intentionally absent from routine deploys.
// A merchant-approved LIVE provider and finalized sale document must be wired
// server-side before any flag can enable this handler. No key lookup here.
exports.replayPurchase = onRequest(
  { region: "asia-northeast3", invoker: "public", timeoutSeconds: 60, minInstances: 0, maxInstances: 1 },
  (req, res) => createReplayProductionPurchaseHandler({ db: getFirestore(),
    verifyToken: token => getAuth().verifyIdToken(token, true), env: process.env })(req, res),
);

exports.cleanupBoardPostComments = onDocumentDeleted(
  { document: "board_posts/{postId}", region: "asia-northeast3" },
  async (event) => {
    const comments = getFirestore()
      .collection("board_posts")
      .doc(event.params.postId)
      .collection("comments");

    while (true) {
      const snapshot = await comments.limit(400).get();
      if (snapshot.empty) return;
      const batch = getFirestore().batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  },
);

exports.discordMatchSession = onRequest(
  { region: "asia-northeast3", invoker: "public", timeoutSeconds: 15 },
  createDiscordSessionHandler({ db: getFirestore(), ...discordSessionConfig }),
);

// Dormant until explicitly configured for a small allowlisted mock test.
// The existing deployment workflow intentionally does not target this function.
exports.replayCoachingPreview = onRequest(
  { region: "asia-northeast3", invoker: "public", timeoutSeconds: 30, minInstances: 0, maxInstances: 1 },
  createReplayCoachingHandler({ db: getFirestore(), verifyToken: token => getAuth().verifyIdToken(token) }),
);

// Preparation only. Deliberately disabled and absent from the deploy workflow;
// activation requires explicit secret/provider/config wiring and billing grants.
exports.replayCoachingReview = onRequest(
  { region: "asia-northeast3", invoker: "public", timeoutSeconds: 60, minInstances: 0, maxInstances: 1 },
  createReplayReviewHandler({ db: getFirestore(), verifyToken: token => getAuth().verifyIdToken(token, true) }),
);

// Merchant review only. Excluded from routine deployment; explicit activation
// and TEST secrets are required. Never binds LIVE keys or operating credits.
exports.replayPurchaseTest = onRequest(
  { region: "asia-northeast3", invoker: "public", timeoutSeconds: 60, minInstances: 0, maxInstances: 1,
    secrets: ["TOSSPAY_REVIEW_API_KEY", "TOSSPAY_REVIEW_ACCESS_KEY"] },
  (req, res) => {
    let provider;
    const enabled = process.env.TOSSPAY_REVIEW_ENABLED === "true";
    if (enabled) {
      try { provider = createTossPayTestClient({ enabled: true, apiKey: process.env.TOSSPAY_REVIEW_API_KEY,
        retUrl: "https://trackingsa.com/ai-replay-pass/?return=1",
        retCancelUrl: "https://trackingsa.com/ai-replay-pass/?return=1&cancel=1" }); }
      catch { /* Disabled response below; never expose key validation errors. */ }
    }
    return createMerchantTestHandler({ db: getFirestore(), enabled, accessKey: process.env.TOSSPAY_REVIEW_ACCESS_KEY,
      provider })(req, res);
  },
);
