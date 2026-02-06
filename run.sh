#!/bin/bash

# Activate the virtual environment
source venv/bin/activate

# Install dependencies (this will use the activated venv's pip)
pip install -r requirements.txt

# Run the main script in build-only mode (API 호출 안 함)
venv/bin/python main.py --build-only

# List the contents of the public directory for debugging
ls -R public