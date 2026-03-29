"""
render_canvas — function tool that broadcasts a visual artifact to the frontend canvas panel.

Content schemas by artifact_type:

  markdown:
    Plain markdown string.
    e.g. "# Analysis\\n\\n**Strength:** Good metrics.\\n\\n- ARR: 40% YoY"

  bullet_list:
    JSON array of strings.
    e.g. ["Clarify go-to-market", "Add competitive moat slide", "Quantify TAM"]

  table:
    JSON object with headers array and rows array of arrays.
    e.g. {"headers": ["Criteria", "Option A", "Option B"],
          "rows": [["Cost", "$500/mo", "$200/mo"], ["Setup", "2 weeks", "1 day"]]}

  scorecard:
    JSON array of score objects.
    e.g. [{"label": "Clarity", "score": 8, "feedback": "Well structured"},
          {"label": "Metrics", "score": 6, "feedback": "Needs growth rate data"}]
"""

import json
import logging
import time

from livekit.agents import function_tool, RunContext

from .config import CANVAS_CONFIG

logger = logging.getLogger("canvas-tool")


@function_tool
async def render_canvas(
    context: RunContext,
    artifact_type: str,
    title: str,
    content: str,
    spoken_summary: str,
) -> str:
    """Render a visual artifact in the user's canvas panel.
    Only use this when canvas mode is active (user enabled it).
    Speak spoken_summary aloud — never read the full canvas content.

    artifact_type: one of markdown | bullet_list | table | scorecard
    title: short title shown in the panel tab
    content: artifact content as a string (see module docstring for schemas)
    spoken_summary: what you say aloud while the canvas renders (max 2 sentences)
    """
    # Guard: canvas mode must be ON
    if not context.userdata.get("canvas_mode", False):
        logger.debug("[Canvas] render_canvas called but canvas_mode is OFF — skipping")
        return spoken_summary

    # Guard: type must be in allowed list
    if artifact_type not in CANVAS_CONFIG.allowed_types:
        logger.warning(f"[Canvas] Blocked disallowed artifact type: {artifact_type!r}")
        return spoken_summary

    # Guard: content length
    if len(content) > CANVAS_CONFIG.max_content_length:
        content = content[: CANVAS_CONFIG.max_content_length]
        logger.warning("[Canvas] Artifact content truncated to max_content_length")

    room = context.userdata.get("room")
    if not room:
        logger.warning("[Canvas] No room in userdata — artifact not broadcast")
        return spoken_summary

    payload = json.dumps({
        "type": "canvas_artifact",
        "artifact_type": artifact_type,
        "title": title,
        "content": content,
        "ts": time.time(),
    }).encode("utf-8")

    await room.local_participant.publish_data(payload, reliable=True)
    logger.info(f"[Canvas] Artifact broadcast: type={artifact_type!r} title={title!r}")

    return spoken_summary
