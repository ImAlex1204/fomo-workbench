"""Gemini function-calling loop over openbb-mcp data tools + the local fingpt_forecast tool."""
import asyncio
import json
import os

from google import genai
from google.genai import types

from tools import fingpt_tool, finrl_tool

MCP_TOOLS = ["equity_profile", "equity_price_quote", "equity_price_historical", "news_company", "equity_fundamental_metrics"]
MAX_ROUNDS = 8
RESULT_CHARS = 12000  # truncate big MCP payloads (e.g. long price history) before they hit the context

SYSTEM = """You are a financial research assistant inside a local OpenBB x AI4Finance workbench.
Answer questions about stocks using the OpenBB data tools (prices, quotes, profile, news, fundamentals).
When the user wants an outlook, sentiment, or "what does FinGPT say", call fingpt_forecast(ticker):
it runs the FinGPT-Forecaster model locally (~1 minute) on OpenBB news and prices, and returns a
[Positive Developments] / [Potential Concerns] / [Prediction & Analysis] report. Quote its prediction
and summarize its reasoning; do not invent your own price prediction. When the user asks about
trade signals, quant/RL signals, or wants FinRL and FinGPT compared, call finrl_signal(ticker):
it returns five independent DRL agents' BUY/SELL/HOLD intents for a DOW 30 stock (fast). Report
the agents individually, note where they disagree with each other or with FinGPT, and never
merge them into a single recommendation. Be concise and cite which tool each fact came from.
FinGPT and FinRL outputs are model opinions, not investment advice."""


def _gemini_schema(schema):
    """Keep the JSON-schema subset Gemini accepts; drop `provider` (injected as yfinance at call time)."""
    out = {"type": "object", "properties": {}}
    for name, prop in schema.get("properties", {}).items():
        if name == "provider":
            continue
        if "anyOf" in prop:  # e.g. string | null -> string
            prop = {**next(o for o in prop["anyOf"] if o.get("type") != "null"), "description": prop.get("description", "")}
        out["properties"][name] = {k: prop[k] for k in ("type", "description", "enum", "format") if k in prop}
    required = [r for r in schema.get("required", []) if r != "provider"]
    if required:
        out["required"] = required
    return out


class Agent:
    def __init__(self, mcp_session, mcp_tools):
        self.session = mcp_session
        self.client = genai.Client()  # reads GEMINI_API_KEY
        self.model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
        decls = [types.FunctionDeclaration(name=t.name, description=t.description, parameters=_gemini_schema(t.input_schema))
                 for t in mcp_tools if t.name in MCP_TOOLS]
        decls.append(types.FunctionDeclaration(
            name="fingpt_forecast", description=fingpt_tool.forecast.__doc__,
            parameters={"type": "object", "properties": {"ticker": {"type": "string", "description": "Stock ticker, e.g. AAPL"}}, "required": ["ticker"]}))
        decls.append(types.FunctionDeclaration(
            name="finrl_signal", description=finrl_tool.signal.__doc__,
            parameters={"type": "object", "properties": {"ticker": {"type": "string", "description": "DOW 30 stock ticker, e.g. AAPL"}}, "required": ["ticker"]}))
        self.config = types.GenerateContentConfig(
            system_instruction=SYSTEM, tools=[types.Tool(function_declarations=decls)],
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))

    async def _stream_fingpt(self, args):
        """Run fingpt_forecast in a thread, yielding ("token", text) as it generates, then ("result", dict)."""
        q: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()
        task = asyncio.create_task(asyncio.to_thread(fingpt_tool.forecast, **args, on_token=lambda t: loop.call_soon_threadsafe(q.put_nowait, t)))
        while not task.done():
            try:
                yield "token", await asyncio.wait_for(q.get(), 0.5)
            except asyncio.TimeoutError:
                pass
        while not q.empty():
            yield "token", q.get_nowait()
        yield "result", task.result()

    async def call_tool(self, name, args):
        if name == "fingpt_forecast":
            return await asyncio.to_thread(fingpt_tool.forecast, **args)
        if name == "finrl_signal":
            return await asyncio.to_thread(finrl_tool.signal, **args)
        res = await self.session.call_tool(name, {**args, "provider": "yfinance"})
        text = "".join(getattr(c, "text", "") for c in res.content)
        return {"error": text} if res.is_error else {"result": text[:RESULT_CHARS]}

    async def _generate(self, contents):
        """generate_content with retries on transient 429/503 (the free tier throws these under load)."""
        for wait in (5, 15, 30, None):
            try:
                return await self.client.aio.models.generate_content(model=self.model, contents=contents, config=self.config)
            except Exception as e:
                # a daily-quota 429 ("...PerDay...FreeTier") will not clear by waiting; only retry the transient ones
                if wait is None or not any(code in str(e) for code in ("429", "503")) or "PerDay" in str(e):
                    raise
                await asyncio.sleep(wait)

    async def run(self, message):
        """Yield events: tool_call, tool_stream (FinGPT tokens), tool_result, text (final answer), error."""
        contents = [types.Content(role="user", parts=[types.Part(text=message)])]
        for _ in range(MAX_ROUNDS):
            resp = await self._generate(contents)
            if not resp.function_calls:
                yield {"type": "text", "text": resp.text or ""}
                return
            contents.append(resp.candidates[0].content)
            parts = []
            for fc in resp.function_calls:
                args = dict(fc.args or {})
                yield {"type": "tool_call", "name": fc.name, "args": args}
                try:
                    if fc.name == "fingpt_forecast":  # streamed so the UI can show the report as it is written
                        async for kind, val in self._stream_fingpt(args):
                            if kind == "token":
                                yield {"type": "tool_stream", "name": fc.name, "text": val}
                            else:
                                result = val
                    else:
                        result = await self.call_tool(fc.name, args)
                except Exception as e:  # tool failure goes back to the model, not to the user
                    result = {"error": str(e)}
                yield {"type": "tool_result", "name": fc.name, "preview": json.dumps(result, ensure_ascii=False)[:300]}
                parts.append(types.Part.from_function_response(name=fc.name, response=result))
            contents.append(types.Content(role="user", parts=parts))
        yield {"type": "error", "text": f"stopped after {MAX_ROUNDS} tool rounds"}
