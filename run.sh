#!/bin/bash

# Install dependencies
pip install -r requirements.txt

# Run the main script in build-only mode (API 호출 안 함)
python3 main.py --build-only

# List the contents of the public directory for debugging
ls -R public