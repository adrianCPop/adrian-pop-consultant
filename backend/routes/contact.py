import os
import re
import logging
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger("contact")

router = APIRouter(prefix="/contact", tags=["contact"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class ContactPayload(BaseModel):
    name: str
    email: str
    message: str
    botField: str = ""


@router.post("/send-email")
async def send_email(payload: ContactPayload, request: Request):
    if payload.botField.strip():
        return JSONResponse({"success": False, "error": "Spam detected"}, status_code=400)

    if not payload.name or not payload.email or not payload.message:
        return JSONResponse({"success": False, "error": "Missing required fields"}, status_code=400)

    if not EMAIL_RE.match(payload.email):
        return JSONResponse({"success": False, "error": "Invalid email"}, status_code=400)

    if len(payload.message.strip()) < 10:
        return JSONResponse({"success": False, "error": "Message too short"}, status_code=400)

    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.error("RESEND_API_KEY not set")
        return JSONResponse({"success": False, "error": "Server misconfiguration"}, status_code=500)

    import httpx
    name = payload.name.replace("<", "").replace(">", "")
    email = payload.email.replace("<", "").replace(">", "")
    message = payload.message.replace("<", "").replace(">", "")

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "from": "Contact Form <contact@adrianpop.tech>",
                    "to": "adrian.c.pop@gmail.com",
                    "subject": f"New message from {name}",
                    "html": f"<p><strong>Name:</strong> {name}</p>"
                            f"<p><strong>Email:</strong> {email}</p>"
                            f"<p><strong>Message:</strong><br/>{message}</p>",
                },
                timeout=10.0,
            )

        if not res.is_success:
            logger.error("Resend error %s: %s", res.status_code, res.text)
            return JSONResponse({"success": False, "error": "Failed to send email"}, status_code=500)

        return JSONResponse({"success": True})

    except Exception as exc:
        logger.exception("Unexpected error sending email: %s", exc)
        return JSONResponse({"success": False, "error": "Failed to send email"}, status_code=500)
