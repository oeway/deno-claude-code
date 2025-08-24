#!/bin/bash

# Test stop functionality
AGENT_ID=$(curl -s -X POST http://localhost:8080/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "workingDirectory": "./agent-workspaces/test-stop",
    "permissionMode": "default"
  }' | jq -r '.id')

echo "Created agent: $AGENT_ID"

# Start a long task in background
echo "Starting long task..."
curl -s -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT_ID\",
    \"message\": \"Write a bash script that counts from 1 to 100 with a 1 second delay between each number, then run it\"
  }" > /tmp/response.txt 2>&1 &

CURL_PID=$!

# Wait 3 seconds then stop
sleep 3
echo "Stopping execution..."
curl -s -X POST http://localhost:8080/api/stop \
  -H "Content-Type: application/json" \
  -d "{\"agentId\": \"$AGENT_ID\"}"

# Wait for curl to finish
wait $CURL_PID

echo "Response (should be aborted):"
grep -o "aborted\|done\|error" /tmp/response.txt | head -5

# Cleanup
curl -s -X DELETE "http://localhost:8080/api/agents/$AGENT_ID"
echo "Test complete"