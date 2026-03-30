"""add artifacts to sessions

Revision ID: f3a4b5c6d7e8
Revises: d1e2f3a4b5c6
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f3a4b5c6d7e8'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pitch_sessions',
        sa.Column('artifacts', postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('pitch_sessions', 'artifacts')
