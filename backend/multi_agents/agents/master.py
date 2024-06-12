import os
import time
from langgraph.graph import StateGraph, END
from .utils.views import print_agent_output
from backend.memory.research import ResearchState

# Import agent classes
from . import \
    WriterAgent, \
    EditorAgent, \
    PublisherAgent, \
    ResearchAgent


# backend/multi_agents/agents/master.py

class ChiefEditorAgent:
    def __init__(self, task: dict, websocket):
        self.task_id = int(time.time()) # Currently time based, but can be any unique identifier
        self.output_dir = f"./outputs/run_{self.task_id}_{task.get('query')[0:40]}"
        self.task = task
        self.websocket = websocket
        os.makedirs(self.output_dir, exist_ok=True)

    def init_research_team(self, task, websocket):
        # Initialize agents
        writer_agent = WriterAgent(websocket)
        editor_agent = EditorAgent(websocket)
        research_agent = ResearchAgent(websocket)
        publisher_agent = PublisherAgent(self.output_dir)

        # Define a Langchain StateGraph with the ResearchState
        workflow = StateGraph(ResearchState)

        # Add nodes for each agent
        workflow.add_node("browser", research_agent.run_initial_research)
        workflow.add_node("planner", editor_agent.plan_research)
        workflow.add_node("researcher", editor_agent.run_parallel_research)
        workflow.add_node("writer", writer_agent.run)
        workflow.add_node("publisher", publisher_agent.run)

        workflow.add_edge('browser', 'planner')
        workflow.add_edge('planner', 'researcher')
        workflow.add_edge('researcher', 'writer')
        workflow.add_edge('writer', 'publisher')

        # set up start and end nodes
        workflow.set_entry_point("browser")
        workflow.add_edge('publisher', END)

        return workflow

    async def run_research_task(self, websocket=None):
        # Example of sending a message at an important point
        if websocket:
            await websocket.send_json({"type": "info", "message": "Multi-Agent Research task started"})

        research_team = self.init_research_team(websocket)

        # compile the graph
        chain = research_team.compile()

        print_agent_output(f"Starting the research process for query '{self.task.get('query')}'...", "MASTER")
        result = await chain.ainvoke({"task": self.task})

        return result