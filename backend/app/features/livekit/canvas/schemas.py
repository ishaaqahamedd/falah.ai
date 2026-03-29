from typing import Literal
from pydantic import BaseModel

ArtifactType = Literal["markdown", "bullet_list", "table", "scorecard"]


class CanvasArtifact(BaseModel):
    artifact_type: ArtifactType
    title: str
    content: str        # JSON string — schema varies by type (see tool.py docstring)
    spoken_summary: str
    ts: float
