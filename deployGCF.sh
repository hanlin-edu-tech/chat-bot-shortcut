#!/bin/bash

FUNCTION_NAME='convertToShortcut'
RUNTIME='nodejs16'
MEMORY='128'
REGION='asia-east1'

cd ./functions
gcloud functions deploy $FUNCTION_NAME --runtime $RUNTIME --trigger-http --allow-unauthenticated --set-secrets SHORTCUT_API_TOKEN=shortcut-api-token:latest --memory $MEMORY --region $REGION
