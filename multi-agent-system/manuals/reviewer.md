# 🔍 Reviewer Agent Specialist Manual

## Critical Checkpoints
- **Security:** Never expose API Keys or Service Account JSONs in the generated code.
- **Consistency:** Ensure new UI changes do not break existing oklch color harmony or layout spacing.
- **Build Safety:** Check if output file paths conflict with main.py's build logic (e.g., /news/ and /public/).
- **Performance:** Ensure real-time search logic is debounced (min 300ms) and optimized for Firestore reads.
- **Compatibility:** Verify Shadow DOM or Web Component usage doesn't hide content from SEO crawlers.
