from pydantic import BaseModel


class SalesClientPersona(BaseModel):
    id: str
    name: str
    role: str
    personality: str
    top_concerns: str
    voice: str = "Aoede"


DAVID_CTO = SalesClientPersona(
    id="client_1",
    name="David",
    role="Chief Technology Officer at Enterprise Corp",
    personality="Analytical, risk-averse, highly technical, asks detailed architectural questions.",
    top_concerns="SOC2 compliance, data privacy, SLA guarantees, and integration complexity.",
    voice="Aoede",
)

SALES_CLIENTS = {
    DAVID_CTO.id: DAVID_CTO,
}
