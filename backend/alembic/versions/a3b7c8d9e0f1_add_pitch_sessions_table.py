"""Add pitch_sessions table

Revision ID: a3b7c8d9e0f1
Revises: 224ef1d0c9e8
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'a3b7c8d9e0f1'
down_revision: Union[str, Sequence[str], None] = '11e3a9d4c4f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('pitch_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('persona_id', sa.UUID(), nullable=True),
        sa.Column('persona_snapshot', JSONB(), nullable=True),
        sa.Column('transcript', JSONB(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('ACTIVE', 'COMPLETED', 'CRASHED', name='sessionstatus'), nullable=False),
        sa.Column('scorecard', JSONB(), nullable=True),
        sa.Column('ai_summary', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pitch_sessions_user_id'), 'pitch_sessions', ['user_id'], unique=False)
    op.create_index(op.f('ix_pitch_sessions_persona_id'), 'pitch_sessions', ['persona_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_pitch_sessions_persona_id'), table_name='pitch_sessions')
    op.drop_index(op.f('ix_pitch_sessions_user_id'), table_name='pitch_sessions')
    op.drop_table('pitch_sessions')
    op.execute("DROP TYPE IF EXISTS sessionstatus")
