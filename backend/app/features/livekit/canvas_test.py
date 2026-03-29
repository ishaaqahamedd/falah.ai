"""
Phase 0 — Canvas feasibility test tool.

Tests two things:
  1. RunContext.userdata gives access to the room object (so tools can broadcast)
  2. Custom function tool + GoogleSearch coexist in the same AgentSession

HOW TO TEST:
  Start a session with an agent that has grounding_enabled=True.
  Say: "canvas test hello world"

  Expected backend log:
    [Canvas-Test] echo_canvas called: hello world
    [Canvas-Test] Broadcast sent to room

  Expected frontend console (open DevTools → Console):
    CANVAS TEST: { type: 'canvas_test', message: 'hello world', room_ok: true }

  If room_ok is true → Test 1 PASSED (userdata + room access works)
  If no error about tool conflict → Test 2 PASSED (tools coexist)

REMOVE this file once Phase 0 passes.
"""

import json
import logging
import time

from livekit.agents import function_tool, RunContext

logger = logging.getLogger("canvas-test")


@function_tool
async def echo_canvas(
    context: RunContext,
    message: str,
) -> str:
    """Phase 0 test tool. Say 'canvas test <message>' to trigger this.
    Broadcasts a canvas_test message via data channel to verify room access.
    """
    logger.info(f"[Canvas-Test] echo_canvas called: {message}")

    room = context.userdata.get("room") if isinstance(context.userdata, dict) else None
    room_ok = room is not None

    if room_ok:
        payload = json.dumps({
            "type": "canvas_test",
            "message": message,
            "room_ok": True,
            "ts": time.time(),
        }).encode("utf-8")
        await room.local_participant.publish_data(payload, reliable=True)
        logger.info("[Canvas-Test] Broadcast sent to room ✓")
    else:
        logger.warning("[Canvas-Test] room is None — userdata access FAILED ✗")

    return f"Canvas test received: {message}. Room access: {'OK' if room_ok else 'FAILED'}."
