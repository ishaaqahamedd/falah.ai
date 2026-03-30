"""add artifacts to sessions

Revision ID: f3a4b5c6d7e8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f3a4b5c6d7e8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pitch_sessions',
        sa.Column('artifacts', postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('pitch_sessions', 'artifacts')
