#!/bin/sh

SCRIPT_FOLDER=$(cd $(dirname "$0"); pwd)
ORCHESTRATOR_FOLDER=tools/orchestrator

cd $ORCHESTRATOR_FOLDER
npm run build
cd ../..

