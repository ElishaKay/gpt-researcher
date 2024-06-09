#!/bin/bash

# Run langgraph up
langgraph up

# Start the application
uvicorn main:app --host 0.0.0.0 --port 8000