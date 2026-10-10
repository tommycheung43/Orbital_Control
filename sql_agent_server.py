from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from deepagents import create_deep_agent
from deepagents.backends.filesystem import FilesystemBackend
from langgraph.checkpoint.memory import MemorySaver
import uvicorn
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SQLRequest(BaseModel):
    sql_code: str


checkpointer = MemorySaver()
root_dir = "."
backend = FilesystemBackend(root_dir=root_dir, virtual_mode=True)

agent = create_deep_agent(
    model="ollama:gemma4:cloud",  
    backend=backend,
    tools=[], 
    skills=[str(Path(root_dir) / "skills")],
    interrupt_on={
            "write_file": True,
            "read_file": False,
            "edit_file": True,
        },
    checkpointer=checkpointer,
)

@app.post("/explain_sql")
def explain_sql(request: SQLRequest):
    try:
        prompt = f"Please explain the following SQL query step by step based on the sql-tutor-docs skill:\n\n{request.sql_code}"
    
        result = agent.invoke(
            {"messages": [{"role": "user", "content": prompt}]},
            config={"configurable": {"thread_id": "sql_tutor_session"}},
        )
    
        explanation = result["messages"][-1].content
        return {"explanation": explanation}
    
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503, 
            detail="Unable to connect to the Ollama service. Please ensure Ollama is running in the background."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"An error occurred during the execution of the AI ​​Agent: {str(e)}"
        )



if __name__ == "__main__":
    print("Starting AI SQL Tutor ...")
    uvicorn.run(app, host="127.0.0.1", port=8000)