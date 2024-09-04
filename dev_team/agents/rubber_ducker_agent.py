from .utils.llms import call_model
from dev_team.agents import GithubAgent
import os
sample_json = """
{
  "thoughts": "Your step-by-step reasoning here"
}
"""
class RubberDuckerAgent:
    async def think_aloud(self, state):
        github_agent = GithubAgent(github_token=os.environ.get("GITHUB_TOKEN"), repo_name='elishakay/gpt-researcher', branch_name="devs", vector_store=state.get("vector_store"))

        file_names_to_search = ["backend/server.py", "backend/websocket_manager.py"]

        # Fetch the matching documents
        matching_docs = await github_agent.search_by_file_name(file_names_to_search)
        print("matching_docs: ", matching_docs,flush=True)

        prompt = [
            {"role": "system", "content": "You are a rubber duck debugging assistant."},
            {"role": "user", "content": f"""
            Based on the repository analysis:
            {state.get("repo_analysis")}
            
            And the web search results:
            {state.get("web_search_results")}

            Here is the repo's directory structure: {state.get("github_data")}

            Here are some relevant files from the developer's branch: {matching_docs}
                
            If neccessary, please provide the full code snippets 
            & relevant file names to add or edit on the branch in order to solve the developer's question.
            
            Think out loud about the game plan for answering the user's question. 
            Explain your reasoning step by step.

            You MUST return nothing but a JSON in the following format (without json markdown).
            Respond in the following JSON format: {sample_json}
            """}
        ]

        response = await call_model(
            prompt=prompt,
            model=state.get("model")
        )
        return {"rubber_ducker_thoughts": response} 