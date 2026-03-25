"""add_onboarding_fields_to_users

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-03-16 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("onboarding_status", sa.String(20), nullable=False, server_default="pending"))
    op.add_column("users", sa.Column("onboarding_step", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True))

    # Mark all existing users as completed so they don't see the onboarding modal
    op.execute("UPDATE users SET onboarding_status = 'completed' WHERE created_at < NOW()")


def downgrade() -> None:
    op.drop_column("users", "onboarding_completed_at")
    op.drop_column("users", "onboarding_step")
    op.drop_column("users", "onboarding_status")
