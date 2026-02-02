#!/bin/bash

# Enter a nix-shell with python and necessary packages
nix-shell -p \
  python311 \
  python311Packages.feedparser \
  python311Packages.python-dotenv \
  python311Packages.flask \
  --run "
    # Create a virtual environment if it doesn't exist
    if [ ! -d \".venv\" ]; then
      python3 -m venv .venv
    fi

    # Activate the virtual environment
    source .venv/bin/activate

    # Install/update necessary packages in the virtual environment
    pip install -U google-generativeai Flask python-dotenv

    # Start the Flask app in the background, logging output to app.log
    # Use nohup to ensure it runs even if the parent shell exits
    nohup python3 app.py > app.log 2>&1 &
    echo \"Flask app started in background (PID: $!)\"

    # Run the main Python script for auto-posting
    python3 main.py
    echo \"Auto-posting script finished.\"

    # Keep the nix-shell active so the background Flask app continues to run
    # This command will block indefinitely
    tail -f /dev/null
  "
