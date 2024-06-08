# Use python:3.11.4-slim-bullseye as the base image
FROM python:3.11.4-slim-bullseye as install-browser

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file from the host to the container
COPY requirements.txt /app/requirements.txt

# Install dependencies
RUN pip install -r requirements.txt

# Copy the .env file from the host to the container
COPY .env /app/.env

# Expose the port that the API server will run on
EXPOSE 8123

# Command to start the API server
CMD ["langgraph", "up"]

