from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.api.app.core.events import event_bus
from services.api.app.core.logging import logger

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/v1/jobs/{job_id}")
async def websocket_job_progress(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for live 9-stage pipeline progress tracking.
    Stages: perception -> io_parse -> cleanup -> llm_resolve -> validate -> graph -> simplify -> layout -> report
    """
    await event_bus.connect(job_id, websocket)
    try:
        while True:
            # Keep connection alive; handle client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await event_bus.disconnect(job_id, websocket)
    except Exception as e:
        logger.warning(f"WebSocket error on job {job_id}: {e}")
        await event_bus.disconnect(job_id, websocket)
