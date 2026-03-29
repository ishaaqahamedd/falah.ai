from typing import Literal
from pydantic import BaseModel

ArtifactType = Literal["markdown", "bullet_list", "table", "scorecard"]
ArtifactMode = Literal["new", "replace", "append"]


class CanvasArtifact(BaseModel):
    artifact_type: ArtifactType
    mode: ArtifactMode       # new=new tab, replace=overwrite same title, append=add to existing
    title: str
    content: str             # JSON string — schema varies by type (see tool.py docstring)
    spoken_summary: str
    ts: float
