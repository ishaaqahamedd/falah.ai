from pydantic import BaseModel


class InvestorPersona(BaseModel):
    id: str
    name: str
    role: str
    personality: str
    investment_focus: str
    voice: str = "Puck"


SARAH_VC = InvestorPersona(
    id="investor_1",
    name="Sarah",
    role="Managing Partner at Tier 1 VC",
    personality="Strict, no-nonsense, hates buzzwords, extremely direct.",
    investment_focus="ARR growth rate (>3x), capital efficiency, strong product-market fit evidence.",
    voice="Puck",
)

# Can add more investor variants here later
INVESTORS = {
    SARAH_VC.id: SARAH_VC,
}
