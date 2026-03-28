"""OpenTelemetry bootstrap — opt-in via OTEL_EXPORTER_OTLP_ENDPOINT env var."""

import os
import logging

logger = logging.getLogger(__name__)


def setup_telemetry(app: object) -> None:
    """Instrument FastAPI, SQLAlchemy, and httpx if an OTLP endpoint is configured.

    When OTEL_EXPORTER_OTLP_ENDPOINT is unset the function is a no-op,
    so local dev and environments without a collector are unaffected.
    """
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint:
        logger.info("OTEL_EXPORTER_OTLP_ENDPOINT not set — telemetry disabled")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        resource = Resource.create({"service.name": "falah-backend"})
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint))
        )
        trace.set_tracer_provider(provider)

        # Auto-instrument FastAPI
        FastAPIInstrumentor.instrument_app(app)

        # Auto-instrument SQLAlchemy engine
        from app.db.database import engine

        SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)

        # Auto-instrument outbound HTTP calls (httpx)
        HTTPXClientInstrumentor().instrument()

        logger.info("OpenTelemetry instrumentation activated → %s", endpoint)
    except Exception:
        logger.exception(
            "Failed to initialise OpenTelemetry — continuing without tracing"
        )
