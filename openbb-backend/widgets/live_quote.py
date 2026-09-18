"""GET /live/{ticker}: server-sent events with real-time trades from Yahoo's streamer.

Phase 10B. openbb-api has no streaming endpoint, so this uses the yfinance package's WebSocket client
directly (same exception as eps_trend / institutional). Unofficial protocol: if Yahoo changes it,
the UI silently falls back to the 60s polling it already does.

Event: {"price", "time" (ms epoch), "change", "change_percent", "market_hours" (0 pre, 1 regular, 2 post, 3 extended)}
"""
import asyncio
import json

import yfinance as yf
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

FIELDS = ("price", "time", "change", "change_percent", "market_hours", "day_volume")
HEARTBEAT_S = 15
router = APIRouter()


async def _events(ticker: str):
    queue: asyncio.Queue = asyncio.Queue()
    ws = yf.AsyncWebSocket(verbose=False)

    async def handler(msg):
        if msg.get("id") == ticker:
            await queue.put({k: msg[k] for k in FIELDS if k in msg})

    await ws.subscribe([ticker])
    listener = asyncio.create_task(ws.listen(handler))
    try:
        while True:
            try:
                tick = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_S)
                yield f"data: {json.dumps(tick)}\n\n"
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"  # SSE comment keeps proxies/browsers from dropping an idle stream
            if listener.done():  # Yahoo closed the socket; end the stream so the client can reconnect
                return
    finally:
        listener.cancel()
        await ws.close()


@router.get("/live/{ticker}")
async def live(ticker: str):
    return StreamingResponse(_events(ticker.upper()), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
