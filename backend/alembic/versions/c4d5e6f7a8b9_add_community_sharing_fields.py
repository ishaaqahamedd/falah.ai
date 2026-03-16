"""add_community_sharing_fields

Revision ID: c4d5e6f7a8b9
Revises: 2113d4ea67ca
Create Date: 2026-03-16 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = '2113d4ea67ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_public and use_count columns to personas for community sharing."""
    op.add_column('personas', sa.Column('is_public', sa.Boolean, nullable=False, server_default='false'))
    op.add_column('personas', sa.Column('use_count', sa.Integer, nullable=False, server_default='0'))
    op.create_index('ix_personas_is_public', 'personas', ['is_public'])


def downgrade() -> None:
    """Remove community sharing columns."""
    op.drop_index('ix_personas_is_public', table_name='personas')
    op.drop_column('personas', 'use_count')
    op.drop_column('personas', 'is_public')
