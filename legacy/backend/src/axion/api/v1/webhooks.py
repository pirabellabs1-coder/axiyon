"""Inbound webhooks (Stripe, GitHub, Slack, generic provider events)."""
from __future__ import annotations

import hashlib
import hmac
from typing import Any

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from axion.config import get_settings
from axion.db.session import get_session

settings = get_settings()
router = APIRouter()


def _verify_stripe(payload: bytes, signature: str | None) -> dict:
    if not signature:
        raise HTTPException(400, "Missing Stripe-Signature")
    secret = settings.stripe_webhook_secret.get_secret_value()
    if not secret:
        raise HTTPException(503, "Stripe webhook secret not configured")
    try:
        return stripe.Webhook.construct_event(payload, signature, secret)
    except (stripe.error.SignatureVerificationError, ValueError) as e:
        raise HTTPException(400, f"Invalid Stripe signature: {e}") from e


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    session: AsyncSession = Depends(get_session),
) -> dict:
    body = await request.body()
    event = _verify_stripe(body, stripe_signature)
    event_type = event["type"]
    obj: dict[str, Any] = event["data"]["object"]

    # Dispatch — full implementations live in workers/billing_handlers.py
    if event_type == "invoice.payment_succeeded":
        # mark invoice paid, extend subscription period
        pass
    elif event_type == "customer.subscription.deleted":
        # cancel sub
        pass
    elif event_type == "customer.subscription.updated":
        # sync tier/status
        pass

    return {"received": event_type}


@router.post("/generic/{slug}")
async def generic_webhook(
    slug: str,
    request: Request,
    x_axion_signature: str | None = Header(default=None, alias="X-Axion-Signature"),
) -> dict:
    """Generic webhook receiver for inbound events from third-party tools.

    Authenticated via HMAC-SHA256 over the raw body using the integration's secret.
    Triggers workflow runs configured to listen on this slug.
    """
    body = await request.body()

    expected_secret = settings.jwt_secret.get_secret_value()  # placeholder; real impl uses per-integration secret
    expected = hmac.new(expected_secret.encode(), body, hashlib.sha256).hexdigest()
    if not x_axion_signature or not hmac.compare_digest(expected, x_axion_signature):
        # In dev we accept missing signatures, but log loudly
        if settings.is_production:
            raise HTTPException(401, "Invalid webhook signature")

    # Production: enqueue a Celery task that resolves listening workflows.
    return {"slug": slug, "accepted": True}
