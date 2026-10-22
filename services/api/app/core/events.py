import asyncio
import json
from typing import Dict, List, Set
from fastapi import WebSocket


class EventBus:
    """
    In-memory pub/sub WebSocket event bus for live streaming job progress.
    Stage progression:
    perception -> io_parse -> cleanup -> llm_resolve -> validate -> graph -> simplify -> layout -> report
    """
    def __init__(self):
        self._active_connections: Dict[str, Set[WebSocket]] = {}
        self._last_state: Dict[str, dict] = {}
        self._lock = asyncio.Lock()

    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            if job_id not in self._active_connections:
                self._active_connections[job_id] = set()
            self._active_connections[job_id].add(websocket)
            
            # Send latest known status immediately if available
            if job_id in self._last_state:
                await websocket.send_text(json.dumps(self._last_state[job_id]))

    async def disconnect(self, job_id: str, websocket: WebSocket):
        async with self._lock:
            if job_id in self._active_connections:
                self._active_connections[job_id].discard(websocket)
                if not self._active_connections[job_id]:
                    del self._active_connections[job_id]

    async def broadcast(self, job_id: str, data: dict):
        async with self._lock:
            self._last_state[job_id] = data
            connections = list(self._active_connections.get(job_id, []))

        dead_connections = []
        payload = json.dumps(data)
        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead_connections.append(ws)

        if dead_connections:
            async with self._lock:
                if job_id in self._active_connections:
                    for ws in dead_connections:
                        self._active_connections[job_id].discard(ws)


event_bus = EventBus()
