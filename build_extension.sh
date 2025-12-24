#!/bin/bash

# Define the output zip file name
OUTPUT_FILE="gaze-guard-extension.zip"

# Remove existing zip file if it exists
if [ -f "$OUTPUT_FILE" ]; then
    rm "$OUTPUT_FILE"
fi

# Create a zip file excluding node_modules, .git, and other unnecessary files
echo "Creating compressed extension package: $OUTPUT_FILE"

zip -r "$OUTPUT_FILE" . \
    -x "node_modules/*" \
    -x ".git/*" \
    -x ".DS_Store" \
    -x "package-lock.json" \
    -x "package.json" \
    -x "scripts/*" \
    -x "*.zip"

echo "Done! File size:"
ls -lh "$OUTPUT_FILE"
