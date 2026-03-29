"""add_is_system_and_seed_system_personas

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-03-29 16:00:00.000000

Changes:
  - Adds is_system boolean to personas table (default False)
  - Makes user_id nullable to support system-owned personas
  - Seeds 2 system personas: Sarah VC (investor) and David CTO (sales_client)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Stable UUIDs for system personas — never change these
SARAH_VC_ID = "00000000-0000-0000-0000-000000000001"
DAVID_CTO_ID = "00000000-0000-0000-0000-000000000002"


def upgrade() -> None:
    # 1. Add is_system column
    op.add_column(
        "personas",
        sa.Column(
            "is_system",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )

    # 2. Make user_id nullable (system personas have no owner)
    op.alter_column("personas", "user_id", nullable=True)

    # 3. Seed system personas — use raw SQL with ::uuid cast (asyncpg won't auto-cast varchar→uuid)
    import json

    sarah_scoring = json.dumps([
        {"key": "clarity", "label": "Clarity", "desc": "Clear and structured pitch"},
        {"key": "objection_handling", "label": "Objection Handling", "desc": "Addressed concerns effectively"},
        {"key": "engagement", "label": "Engagement", "desc": "Natural conversation flow"},
        {"key": "context_awareness", "label": "Context Awareness", "desc": "Referenced background info"},
        {"key": "closing_strength", "label": "Closing Strength", "desc": "Drove toward next steps"},
    ])
    sarah_rules = json.dumps([
        "Be skeptical of vague claims — demand specific numbers.",
        "Push back hard on market size assertions without evidence.",
        "Ask about competition and why existing solutions aren't enough.",
        "If you see strong metrics on screen, acknowledge them positively.",
        "Drive toward a clear ask — what's the raise, the valuation, the timeline?",
    ])

    david_scoring = json.dumps([
        {"key": "clarity", "label": "Clarity", "desc": "Clear and structured pitch"},
        {"key": "objection_handling", "label": "Objection Handling", "desc": "Addressed concerns effectively"},
        {"key": "engagement", "label": "Engagement", "desc": "Natural conversation flow"},
        {"key": "context_awareness", "label": "Context Awareness", "desc": "Referenced background info"},
        {"key": "closing_strength", "label": "Closing Strength", "desc": "Drove toward next steps"},
    ])
    david_rules = json.dumps([
        "Immediately ask about security certifications and compliance.",
        "Push back on any claim that sounds like marketing — demand proof.",
        "Ask about migration path, rollback strategy, and downtime risks.",
        "If the demo looks good on screen, say so, but follow up with edge-case questions.",
        "You need to present this to your board — ask for materials you can share.",
    ])

    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO personas (id, user_id, is_system, type, name, role, personality, focus_areas,
                              voice, scoring_criteria, behavior_rules, opening_message,
                              grounding_enabled, is_public, use_count)
        VALUES
        (
            :sarah_id ::uuid, NULL, TRUE, 'investor', 'Sarah Chen', 'Managing Partner at Tier 1 VC',
            'Strict, no-nonsense, and deeply analytical. Hates buzzwords and marketing fluff. Cuts straight to the numbers. Values founders who know their unit economics cold and can defend every assumption.',
            'ARR growth rate (>3x YoY), capital efficiency, gross margins, strong product-market fit evidence, competitive moat, team background, path to profitability, and market size (TAM/SAM/SOM).',
            'Puck', :sarah_scoring ::jsonb, :sarah_rules ::jsonb,
            'Open with a warm but efficient greeting. You''re busy — ask them to get started with their pitch.',
            FALSE, FALSE, 0
        ),
        (
            :david_id ::uuid, NULL, TRUE, 'sales_client', 'David Park', 'Chief Technology Officer at Enterprise Corp',
            'Highly technical and extremely risk-averse. Obsessed with security, compliance, and integration complexity. Respects vendors who know their product deeply and don''t oversell. Has been burned by vendors before and is now very cautious about new tooling.',
            'SOC2 compliance, data privacy (GDPR/CCPA), SLA guarantees, integration effort, API reliability, vendor lock-in concerns, total cost of ownership, and migration risk.',
            'Aoede', :david_scoring ::jsonb, :david_rules ::jsonb,
            'Greet them professionally. Mention you have 30 minutes and want to see the product in action.',
            FALSE, FALSE, 0
        )
        ON CONFLICT (id) DO NOTHING
    """), {
        "sarah_id": SARAH_VC_ID,
        "david_id": DAVID_CTO_ID,
        "sarah_scoring": sarah_scoring,
        "sarah_rules": sarah_rules,
        "david_scoring": david_scoring,
        "david_rules": david_rules,
    })


def downgrade() -> None:
    # Remove seeded system personas
    op.execute(
        f"DELETE FROM personas WHERE id IN ('{SARAH_VC_ID}', '{DAVID_CTO_ID}')"
    )

    # Restore user_id to non-nullable
    op.alter_column("personas", "user_id", nullable=False)

    # Drop is_system column
    op.drop_column("personas", "is_system")
