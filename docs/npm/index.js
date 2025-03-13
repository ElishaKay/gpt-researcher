// index.js
const WebSocket = require('ws');

class GPTResearcherWebhook {
  constructor(options = {}) {
    this.host = options.host || 'gpt-researcher:8000';
    this.socket = null;
    this.responseCallbacks = new Map();
    this.logListener = options.logListener;
  }

  // ... (keep existing initializeWebSocket method)

  async sendMessage({
    task,
    reportType = 'research_report',
    reportSource = 'web',
    tone = 'professional',
    queryDomains = []
  }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.initializeWebSocket();
      }

      const message = {
        task,
        report_type: reportType,
        report_source: reportSource,
        tone,
        query_domains: queryDomains
      };

      this.responseCallbacks.set('current', resolve);
      this.socket.send(JSON.stringify(message));
    });
  }
}

module.exports = GPTResearcherWebhook;