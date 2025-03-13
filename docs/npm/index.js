// index.js
const WebSocket = require('ws');

class GPTResearcher {
  constructor(options = {}) {
    this.host = options.host || 'gpt-researcher:8000';
    this.socket = null;
    this.responseCallbacks = new Map();
    this.logListener = options.logListener;
  }

  async initializeWebSocket() {
    if (!this.socket) {
      const ws_uri = `ws://${this.host}/ws`;
      this.socket = new WebSocket(ws_uri);

      this.socket.onopen = () => {
        console.log('WebSocket connection established');
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Handle logs with custom listener if provided
        if (this.logListener) {
          this.logListener(data);
        } else {
          console.log('WebSocket data received:', data);
        }

        const callback = this.responseCallbacks.get('current');
        
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.socket = null;
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    }
  }

  async sendMessage({
    task,
    reportType = 'research_report',
    reportSource = 'web', 
    tone = 'professional',
    queryDomains = [],
    query,
    moreContext,
    repoName = 'assafelovic/gpt-researcher',
    branchName = 'master'
  }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.initializeWebSocket();
      }

      const data = {
        task: query ? `${query}. Additional context: ${moreContext}` : task,
        report_type: reportType,
        report_source: reportSource,
        tone: tone,
        headers: {},
        repo_name: repoName,
        branch_name: branchName,
        query_domains: queryDomains
      };

      const payload = "start " + JSON.stringify(data);

      this.responseCallbacks.set('current', {
        onProgress: (progressData) => {
          resolve({ type: 'progress', data: progressData });
        },
        onComplete: (finalData) => {
          resolve({ type: 'complete', data: finalData });
        }
      });

      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(payload);
        console.log('Message sent:', payload);
      } else {
        this.socket.onopen = () => {
          this.socket.send(payload);
          console.log('Message sent after connection:', payload);
        };
      }
    });
  }
}

module.exports = GPTResearcher;