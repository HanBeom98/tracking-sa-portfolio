# 🎯 Planner Agent Specialist Manual

## Architecture (SSOT)
- **Data:** Firebase Firestore ('posts' collection) is the Single Source of Truth.
- **Routing:** 
  - Root (/) is the Search Hub.
  - (/news/) is for historical and category listings.
- **Build:** main.py handles static generation into /public/.

## Planning Principles
- Prioritize Firestore connectivity.
- Ensure all new features integrate with the existing routing logic.
- Avoid creating local files (.md) for news articles.
- Maintain consistent 'urlKey' formats (YYYY-MM-DD-slug).
