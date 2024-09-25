import asyncio
import datetime
from typing import Dict, List

from fastapi import WebSocket

from backend.report_type import BasicReport, DetailedReport
from gpt_researcher.utils.enum import ReportType, Tone
from multi_agents.main import run_research_task
from gpt_researcher.master.actions import stream_output  # Import stream_output
from multi_agents.dev_team.main import trigger_dev_team_flow
class WebSocketManager:
    """Manage websockets"""

    def __init__(self):
        """Initialize the WebSocketManager class."""
        self.active_connections: List[WebSocket] = []
        self.sender_tasks: Dict[WebSocket, asyncio.Task] = {}
        self.message_queues: Dict[WebSocket, asyncio.Queue] = {}

    async def start_sender(self, websocket: WebSocket):
        """Start the sender task."""
        queue = self.message_queues.get(websocket)
        if not queue:
            return

        while True:
            message = await queue.get()
            if websocket in self.active_connections:
                try:
                    if message == "ping":
                        await websocket.send_text("pong")
                    else:
                        await websocket.send_text(message)
                except:
                    break
            else:
                break

    async def connect(self, websocket: WebSocket):
        """Connect a websocket."""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.message_queues[websocket] = asyncio.Queue()
        self.sender_tasks[websocket] = asyncio.create_task(self.start_sender(websocket))

    async def disconnect(self, websocket: WebSocket):
        """Disconnect a websocket."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            self.sender_tasks[websocket].cancel()
            await self.message_queues[websocket].put(None)
            del self.sender_tasks[websocket]
            del self.message_queues[websocket]


    async def start_streaming(self, task, report_type, report_source, source_urls, tone, websocket, headers, repo_name, branch_name,):
        """Start streaming the output."""
        tone = Tone[tone]
        report = await run_agent(task, report_type, report_source, source_urls, tone, websocket, headers, repo_name, branch_name)
        return report


async def run_agent(task, report_type, report_source, source_urls, tone: Tone, websocket, headers, repo_name, branch_name):
    """Run the agent."""

    print(
        f"Triggering run_agent with repo_name as: {repo_name}",
        flush=True,
    )

    # measure time
    start_time = datetime.datetime.now()
    # add customized JSON config file path here
    config_path = ""
    # Instead of running the agent directly run it through the different report type classes
    if report_type == "multi_agents":
        report = await run_research_task(query=task, websocket=websocket, stream_output=stream_output, tone=tone, headers=headers)
        report = report.get("report", "")
    elif report_type == ReportType.DetailedReport.value:
        researcher = DetailedReport(
            query=task,
            report_type=report_type,
            report_source=report_source,
            source_urls=source_urls,
            tone=tone,
            config_path=config_path,
            websocket=websocket,
            headers=headers
        )
        report = await researcher.run()
    elif report_type == "dev_team":
        # Trigger the dev_team process
        report = await trigger_dev_team_flow(
            repo_name=repo_name,
            branch_name=branch_name,
            query=task,
            websocket=websocket,
            stream_output=stream_output
        )
    else:
        researcher = BasicReport(
            query=task,
            report_type=report_type,
            report_source=report_source,
            source_urls=source_urls,
            tone=tone,
            config_path=config_path,
            websocket=websocket,
            headers=headers
        )
        report = await researcher.run()

    # measure time
    end_time = datetime.datetime.now()
    await websocket.send_json(
        {"type": "logs", "output": f"\nTotal run time: {end_time - start_time}\n"}
    )

    return report