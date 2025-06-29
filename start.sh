#!/bin/bash
# Railway startup script
echo "Starting Fast Help application..."
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: ${NODE_ENV:-development}"

# Start the application
npm start
