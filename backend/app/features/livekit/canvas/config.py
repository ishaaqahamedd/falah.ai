"""
Canvas Configuration — controls what the agent can render and how.
Edit this file to change canvas behavior without touching agent.py or the tool.
"""

from dataclasses import dataclass, field


@dataclass
class CanvasConfig:
    # Which artifact types the agent is allowed to render
    allowed_types: list[str] = field(default_factory=lambda: [
        "markdown",
        "bullet_list",
        "table",
        "scorecard",
    ])

    # Max artifacts per session (prevents panel overflow)
    max_artifacts: int = 10

    # Max content length per artifact in characters
    max_content_length: int = 8000

    # Behavior rules injected into the agent prompt when canvas mode is ON
    behavior_rules: list[str] = field(default_factory=lambda: [
        "CANVAS MODE IS ACTIVE — the user has enabled the canvas panel.",
        "Use render_canvas() for structured output: analysis, comparisons, plans, scorecards, summaries.",
        "Always call render_canvas() AND speak a SHORT summary (1-2 sentences max).",
        "NEVER read the full canvas content aloud — highlight 1-2 key points only.",
        "Use 'scorecard' for ratings and evaluations (score each dimension 1-10).",
        "Use 'table' for side-by-side comparisons of 2+ options.",
        "Use 'bullet_list' for action items, key takeaways, or step-by-step instructions.",
        "Use 'markdown' for summaries, plans, and freeform written analysis.",
    ])

    # Rules injected when canvas mode is OFF
    canvas_off_rules: list[str] = field(default_factory=lambda: [
        "CANVAS MODE IS OFF — respond conversationally only. Do NOT call render_canvas().",
    ])


# Global singleton — imported by agent.py and canvas/tool.py
CANVAS_CONFIG = CanvasConfig()
