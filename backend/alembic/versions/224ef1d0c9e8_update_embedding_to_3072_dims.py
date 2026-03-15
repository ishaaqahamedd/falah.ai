"""Update embedding to 3072 dims

Revision ID: 224ef1d0c9e8
Revises: 2d60353cf6f8
Create Date: 2026-03-13 12:29:13.866172

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '224ef1d0c9e8'
down_revision: Union[str, Sequence[str], None] = '2d60353cf6f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Use raw SQL to alter the vector column dimension
    op.execute('ALTER TABLE context_documents ALTER COLUMN embedding TYPE vector(3072)')


def downgrade() -> None:
    """Downgrade schema."""
    op.execute('ALTER TABLE context_documents ALTER COLUMN embedding TYPE vector(768)')
