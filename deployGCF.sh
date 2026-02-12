#!/bin/bash

FUNCTION_NAME='convertToShortcut'
RUNTIME='nodejs22'
MEMORY='256'
REGION='asia-east1'
SERVICE_ACCOUNT='cloud-functions@chat-bot-shortcut.iam.gserviceaccount.com'
# SERVICE_ACCOUNT='cloud-functions@chat-bot-hanlin-shortcut-2.iam.gserviceaccount.com'

cd ./functions
gcloud functions deploy $FUNCTION_NAME --runtime $RUNTIME --trigger-http --allow-unauthenticated --set-secrets SHORTCUT_API_TOKEN=shortcut-api-token:latest --service-account $SERVICE_ACCOUNT --memory $MEMORY --region $REGION
