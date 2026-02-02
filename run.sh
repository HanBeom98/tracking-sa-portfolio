#!/bin/bash

# Enter a nix-shell with python, feedparser, and python-dotenv
nix-shell -p \
  python311 \
  python311Packages.feedparser \
  python311Packages.python-dotenv \
  --run "
    # Create a virtual environment if it doesn't exist
    if [ ! -d \".venv\" ]; then
      python3 -m venv .venv
    fi

    # Activate the virtual environment
    source .venv/bin/activate

    # Install google-generativeai in the virtual environment
    pip install -U google-generativeai

    # Run the main Python script
    python3 main.py
  "
