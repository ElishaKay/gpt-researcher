FROM python:3.11.4-slim-bullseye as install-browser

RUN apt-get update \
    && apt-get satisfy -y \
    "chromium, chromium-driver (>= 115.0)" \
    && chromium --version && chromedriver --version

RUN apt-get update \
    && apt-get install -y --fix-missing firefox-esr wget \
    && wget https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz \
    && tar -xvzf geckodriver* \
    && chmod +x geckodriver \
    && mv geckodriver /usr/local/bin/

# Install build tools
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Docker
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

FROM install-browser as gpt-researcher-install

ENV PIP_ROOT_USER_ACTION=ignore

RUN mkdir /usr/src/app
WORKDIR /usr/src/app

COPY ./requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

FROM gpt-researcher-install AS gpt-researcher

RUN useradd -ms /bin/bash gpt-researcher \
    && chown -R gpt-researcher:gpt-researcher /usr/src/app

USER gpt-researcher

COPY --chown=gpt-researcher:gpt-researcher ./ ./

# Ensure the correct path to langgraph.json
COPY ./backend/multi_agents/langgraph.json ./langgraph.json

# Switch to root to copy the script and change permissions
USER root
COPY start.sh /usr/src/app/start.sh
RUN chmod +x /usr/src/app/start.sh

# Switch back to the gpt-researcher user
USER gpt-researcher

EXPOSE 8000
CMD ["/usr/src/app/start.sh"]