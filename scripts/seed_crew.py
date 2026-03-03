import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Initialize Firebase (assuming keys are in environment or default path)
service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
if not service_account_path:
    service_account_path = "firebase.json" # Fallback if local

try:
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)
except Exception as e:
    print(f"Error initializing: {e}")
    sys.exit(1)

db = firestore.client()

INITIAL_MEMBERS = [
    'Tracking', '결승', 'alt', '마미', '공대누비', 
    'xion', '김성식', '이쪼룽', '맞고사망한대성', 'SinYang'
]

print("Starting to seed crew members...")
batch = db.batch()
count = 0

for name in INITIAL_MEMBERS:
    doc_ref = db.collection('sa_crew_members').document(name.lower())
    batch.set(doc_ref, {
        'characterName': name,
        'mmr': 1200,
        'wins': 0,
        'loses': 0,
        'approvedAt': firestore.SERVER_TIMESTAMP
    })
    count += 1

batch.commit()
print(f"Successfully seeded {count} members!")
