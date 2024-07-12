from gpt_researcher.master.agent import GPTResearcher
from fastapi import WebSocket
import sys
class BasicReport():
    def __init__(self, query: str, report_type: str, report_source:str, source_urls, config_path: str, websocket: WebSocket, headers):
        print("headers in basic report", headers)
        sys.stdout.flush()
        self.query = query
        self.report_type = report_type
        self.report_source = report_source
        self.source_urls = source_urls
        self.config_path = config_path
        self.websocket = websocket
        self.headers = headers or {}
        
    async def run(self):
        # Initialize researcher
        researcher = GPTResearcher(self.query, self.report_type, self.report_source, self.source_urls, self.config_path, self.websocket, headers=self.headers)
        
        # Run research
        await researcher.conduct_research()
        
        # and generate report        
        report = await researcher.write_report()
        
        return report