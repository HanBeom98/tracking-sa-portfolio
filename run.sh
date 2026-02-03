#!/bin/bash

# Install dependencies
pip install -r requirements.txt

# Run the main script
python3 main.py

# List the contents of the public directory for debugging
ls -R public