import logging
from .investor import INVESTORS, build_investor_prompt
from .sales_client import SALES_CLIENTS, build_sales_client_prompt

logger = logging.getLogger("persona-factory")

def get_persona_prompt(persona_id: str, crm_context: str = "") -> tuple[str, str]:
    """
    Returns (system_prompt, voice_name).
    """
    if persona_id in INVESTORS:
        config = INVESTORS[persona_id]
        prompt = build_investor_prompt(config, crm_context)
        return prompt, config.voice
        
    elif persona_id in SALES_CLIENTS:
        config = SALES_CLIENTS[persona_id]
        prompt = build_sales_client_prompt(config, crm_context)
        return prompt, config.voice

    # Fallback to investor 1
    logger.warning(f"Unknown persona ID '{persona_id}', falling back to default investor.")
    fallback = INVESTORS["investor_1"]
    return build_investor_prompt(fallback, crm_context), fallback.voice
