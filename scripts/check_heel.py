import firebase_admin
from firebase_admin import credentials, firestore
import json

try:
    cred = credentials.Certificate('firebase.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("--- sa_crew_members ---")
    members = db.collection('sa_crew_members').get()
    for m in members:
        print(f"ID(OUID): {m.id} | Data: {m.to_dict()}")

    print("\n--- sa_crew_applications ---")
    apps = db.collection('sa_crew_applications').get()
    for a in apps:
        print(f"ID: {a.id} | Data: {a.to_dict()}")

except Exception as e:
    print(f"Error: {e}")
