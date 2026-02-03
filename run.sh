#!/bin/bash

# Enter a nix-shell with python and necessary packages from requirements.txt
nix-shell -p python311 python311Packages.feedparser python311Packages.python-dotenv python311Packages.requests python311Packages.markdown --run "python3 main.py"