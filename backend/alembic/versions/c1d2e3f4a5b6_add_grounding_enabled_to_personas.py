"""add_grounding_enabled_to_personas

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-03-29 14:00:00.000000

Changes:
  - Adds grounding_enabled boolean to personas table (default False)
    Enables per-persona Google Search grounding in live sessions.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "personas",
        sa.Column(
            "grounding_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("personas", "grounding_enabled")
