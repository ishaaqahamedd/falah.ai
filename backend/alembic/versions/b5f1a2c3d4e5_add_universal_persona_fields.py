"""Add universal persona fields (scoring_criteria, behavior_rules, opening_message) and convert type to varchar

Revision ID: b5f1a2c3d4e5
Revises: 11e3a9d4c4f2, a3b7c8d9e0f1
Create Date: 2026-03-15 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "b5f1a2c3d4e5"
down_revision: Union[str, Sequence[str]] = ("11e3a9d4c4f2", "a3b7c8d9e0f1")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Convert the type column from enum to varchar(100)
    #    First alter column type, then drop the old enum
    op.alter_column(
        "personas",
        "type",
        existing_type=sa.Enum("INVESTOR", "SALES_CLIENT", name="personatype"),
        type_=sa.String(100),
        existing_nullable=False,
        existing_server_default=None,
        postgresql_using="type::text",
    )

    # Drop the old PostgreSQL enum type
    op.execute("DROP TYPE IF EXISTS personatype")

    # 2. Add new universal persona columns
    op.add_column("personas", sa.Column("scoring_criteria", JSONB, nullable=True))
    op.add_column("personas", sa.Column("behavior_rules", JSONB, nullable=True))
    op.add_column("personas", sa.Column("opening_message", sa.Text, nullable=True))


def downgrade() -> None:
    # Remove new columns
    op.drop_column("personas", "opening_message")
    op.drop_column("personas", "behavior_rules")
    op.drop_column("personas", "scoring_criteria")

    # Recreate the enum and convert back
    personatype = sa.Enum("INVESTOR", "SALES_CLIENT", name="personatype")
    personatype.create(op.get_bind(), checkfirst=True)

    op.alter_column(
        "personas",
        "type",
        existing_type=sa.String(100),
        type_=sa.Enum("INVESTOR", "SALES_CLIENT", name="personatype"),
        existing_nullable=False,
        postgresql_using="type::personatype",
    )
