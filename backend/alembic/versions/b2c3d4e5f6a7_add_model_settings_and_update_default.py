"""add_model_settings_and_update_default

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-29 12:00:00.000000

Changes:
  - Adds a JSON `settings` column to ai_model_config for per-model settings
  - Updates the default live_agent_model from gemini-2.5 → gemini-3.1-flash-live-preview
  - Seeds the default settings for the new model (thinking_level: minimal)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add settings column (JSONB — efficient, queryable)
    op.add_column(
        "ai_model_config",
        sa.Column("settings", JSONB, nullable=True),
    )

    # 2. Switch the active model to gemini-3.1-flash-live-preview
    op.execute(
        """
        UPDATE ai_model_config
        SET model_id = 'gemini-3.1-flash-live-preview',
            settings = '{"thinking_level": "minimal"}'::jsonb
        WHERE config_key = 'live_agent_model'
        """
    )

    # 3. Ensure the row exists in case the previous migration was skipped
    op.execute(
        """
        INSERT INTO ai_model_config (config_key, model_id, settings)
        VALUES (
            'live_agent_model',
            'gemini-3.1-flash-live-preview',
            '{"thinking_level": "minimal"}'::jsonb
        )
        ON CONFLICT (config_key) DO NOTHING
        """
    )


def downgrade() -> None:
    # Revert model back to gemini-2.5 and drop the settings column
    op.execute(
        """
        UPDATE ai_model_config
        SET model_id = 'gemini-2.5-flash-native-audio-preview-12-2025',
            settings = NULL
        WHERE config_key = 'live_agent_model'
        """
    )
    op.drop_column("ai_model_config", "settings")
