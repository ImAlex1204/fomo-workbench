"""Agent server: POST /chat streams the Gemini + openbb-mcp + FinGPT loop as SSE. Port 8010."""
import asyncio
import json
from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from pydantic import BaseModel

import brief
from loop import Agent

load_dotenv(Path(__file__).parent / ".env")
MCP_URL = "http://127.0.0.1:8005/mcp"  # openbb-mcp, see .claude/launch.json


@asynccontextmanager
async def lifespan(app):
    async with AsyncExitStack() as stack:
        read, write = await stack.enter_async_context(streamable_http_client(MCP_URL))
        session = await stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        app.state.agent = Agent(session, (await session.list_tools()).tools)
        task = asyncio.create_task(brief.scheduler())
        yield
        task.cancel()


app = FastAPI(title="FinGPT agent", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+", allow_methods=["*"], allow_headers=["*"])


class ChatIn(BaseModel):
    message: str


class WatchlistIn(BaseModel):
    tickers: list[str]


@app.get("/watchlist")
def get_watchlist():
    return brief.load_watchlist()


@app.put("/watchlist")
def put_watchlist(body: WatchlistIn):
    return brief.save_watchlist(body.tickers)


@app.get("/brief")
def get_brief():
    """Latest brief plus {running, progress}; the UI polls this while a run is in progress."""
    return brief.status()


@app.post("/brief/run", status_code=202)
async def run_brief_now():
    if not brief._state["running"]:
        asyncio.create_task(brief.run_brief())
    return {"running": True}


@app.post("/chat")
async def chat(body: ChatIn, request: Request):
    async def events():
        try:
            async for ev in request.app.state.agent.run(body.message):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'text': str(e)})}\n\n"
    return StreamingResponse(events(), media_type="text/event-stream")
