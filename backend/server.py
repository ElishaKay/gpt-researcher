from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from backend.websocket_manager import WebSocketManager
from backend.utils import write_md_to_pdf, write_md_to_word, write_text_to_md
import time
import json
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import shutil
from backend.multi_agents.main import run_research_task


class ResearchRequest(BaseModel):
    task: str
    report_type: str
    agent: str

app = FastAPI()

app.mount("/site", StaticFiles(directory="./frontend"), name="site")
app.mount("/static", StaticFiles(directory="./frontend/static"), name="static")

templates = Jinja2Templates(directory="./frontend")

manager = WebSocketManager()

# Dynamic directory for outputs once first research is run
@app.on_event("startup")
def startup_event():
    if not os.path.isdir("outputs"):
        os.makedirs("outputs")
    app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

@app.get("/")
async def read_root(request: Request):
    return templates.TemplateResponse('index.html', {"request": request, "report": None})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data.startswith("start"):
                json_data = json.loads(data[6:])
                task = json_data.get("task")
                report_type = json_data.get("report_type")
                filename = f"task_{int(time.time())}_{task}"
                report_source = json_data.get("report_source")
                if task and report_type:
                    report = await manager.start_streaming(task, report_type, report_source, websocket)
                    # Saving report as pdf
                    pdf_path = await write_md_to_pdf(report, filename)
                    # Saving report as docx
                    docx_path = await write_md_to_word(report, filename)
                    # Returning the path of saved report files
                    md_path = await write_text_to_md(report, filename)
                    await websocket.send_json({"type": "path", "output": {"pdf": pdf_path, "docx": docx_path, "md": md_path}})
                else:
                    print("Error: not enough parameters provided.")
    except WebSocketDisconnect:
        await manager.disconnect(websocket)

@app.post("/api/multi_agents")
async def run_multi_agents():
    websocket = manager.active_connections[0] if manager.active_connections else None
    if websocket:
        report = await run_research_task(websocket)
        return {"report": report}
    else:
        return JSONResponse(status_code=400, content={"message": "No active WebSocket connection"})

# Enable CORS for your frontend domain (adjust accordingly)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define DOC_PATH
DOC_PATH = os.getenv("DOC_PATH", "./my-docs")
if not os.path.exists(DOC_PATH):
    os.makedirs(DOC_PATH)

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(DOC_PATH, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    print(f"File uploaded to {file_path}")
    return {"filename": file.filename, "path": file_path}

@app.get("/files/")
async def list_files():
    files = os.listdir(DOC_PATH)
    print(f"Files in {DOC_PATH}: {files}")
    return {"files": files}

@app.delete("/files/{filename}")
async def delete_file(filename: str):
    file_path = os.path.join(DOC_PATH, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        print(f"File deleted: {file_path}")
        return {"message": "File deleted successfully"}
    else:
        print(f"File not found: {file_path}")
        return JSONResponse(status_code=404, content={"message": "File not found"})