#!/bin/bash
# Simple script to test journalctl log retrieval

SERVICE_NAME=$1
if [ -z "$SERVICE_NAME" ]; then
  echo "Usage: $0 <service-name>"
  echo "Example: $0 nginx"
  exit 1
fi

# Add .service suffix if not present
if [[ ! $SERVICE_NAME == *.service ]]; then
  SERVICE_NAME="${SERVICE_NAME}.service"
fi

echo "Testing log retrieval for $SERVICE_NAME"
echo "----------------------------------------"

# Check if service exists
systemctl status "$SERVICE_NAME" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: Service $SERVICE_NAME does not exist or is not accessible"
  exit 1
fi

echo "1. Basic service status:"
systemctl status "$SERVICE_NAME" | head -n 10

echo -e "\n2. Testing journalctl with 5 lines:"
journalctl -u "$SERVICE_NAME" -n 5 --no-pager

echo -e "\n3. Testing journalctl with different output format:"
journalctl -u "$SERVICE_NAME" -n 3 -o short-precise --no-pager

echo -e "\n4. Checking journalctl permissions:"
ls -l /var/log/journal/
id

echo -e "\nDone. If no logs appear above, the service may not have any logs or there may be permission issues."
