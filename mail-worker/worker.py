import base64
import email
import imaplib
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from email import policy
from email.message import Message
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

IMAP_HOST = os.environ["IMAP_HOST"]
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.environ["IMAP_USER"]
IMAP_PASSWORD = os.environ["IMAP_PASSWORD"]
IMAP_FOLDER = os.getenv("IMAP_FOLDER", "INBOX")
WORKER_TOKEN = os.environ["MAIL_WORKER_TOKEN"]
WORKER_PORT = int(os.getenv("WORKER_PORT", "8080"))
CONTENT_KEYWORDS = tuple(
    keyword.strip().lower()
    for keyword in os.getenv("MAIL_CONTENT_KEYWORDS", "").split(",")
    if keyword.strip()
)


def header(message: Message, name: str) -> str:
    return str(message.get(name, ""))


def received_within_last_15_minutes(message: Message) -> bool:
    try:
        received_at = parsedate_to_datetime(header(message, "Date"))
        if received_at.tzinfo is None:
            received_at = received_at.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - received_at
        return timedelta(0) <= age <= timedelta(minutes=15)
    except (TypeError, ValueError, OverflowError):
        return False


def decoded_part_text(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        content = part.get_content()
        return content if isinstance(content, str) else ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


class HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def readable_body(message: Message) -> str:
    text_parts: list[str] = []
    html_parts: list[str] = []
    for part in message.walk():
        if part.get_content_maintype() != "text":
            continue
        content = decoded_part_text(part).strip()
        if not content:
            continue
        if part.get_content_type() == "text/plain":
            text_parts.append(content)
        elif part.get_content_type() == "text/html":
            html_parts.append(content)
    if text_parts:
        return "\n\n".join(text_parts)
    if html_parts:
        extractor = HTMLTextExtractor()
        extractor.feed("\n".join(html_parts))
        return " ".join("".join(extractor.parts).split())
    return ""


def content_matches(message: Message, body: str) -> bool:
    searchable_content = f"{header(message, 'Subject')}\n{body}".casefold()
    return bool(CONTENT_KEYWORDS) and any(
        keyword.casefold() in searchable_content for keyword in CONTENT_KEYWORDS
    )


def fetch_matching_mails() -> list[dict[str, str]]:
    since = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%d-%b-%Y")
    mails: list[dict[str, str]] = []
    with imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT) as mailbox:
        mailbox.login(IMAP_USER, IMAP_PASSWORD)
        status, _ = mailbox.select(IMAP_FOLDER, readonly=True)
        if status != "OK":
            raise RuntimeError("IMAP-Ordner konnte nicht geöffnet werden")
        status, data = mailbox.uid("search", None, f"SINCE {since}")
        if status != "OK":
            raise RuntimeError("IMAP-Suche fehlgeschlagen")
        for raw_uid in reversed(data[0].split()):
            status, message_data = mailbox.uid("fetch", raw_uid, "(RFC822)")
            if status != "OK":
                continue
            raw_message = next(
                (part[1] for part in message_data if isinstance(part, tuple)), None
            )
            if not raw_message:
                continue
            message = email.message_from_bytes(raw_message, policy=policy.default)
            if not received_within_last_15_minutes(message):
                continue
            body = readable_body(message)
            if not content_matches(message, body):
                continue
            mails.append(
                {
                    "id": raw_uid.decode("ascii"),
                    "receivedAt": datetime.now(timezone.utc).isoformat(),
                    "subject": header(message, "Subject"),
                    "sender": header(message, "From"),
                    "body": body,
                    "rawMessage": base64.b64encode(raw_message).decode("ascii"),
                }
            )
    return mails


class MailRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/mails":
            self.send_error(404)
            return
        if self.headers.get("Authorization") != f"Bearer {WORKER_TOKEN}":
            self.send_error(401)
            return
        try:
            payload = json.dumps({"mails": fetch_matching_mails()}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception:
            logging.exception("Live-Abruf von Gmail fehlgeschlagen")
            self.send_error(502, "Gmail konnte nicht abgerufen werden")

    def log_message(self, format: str, *args: object) -> None:
        logging.info("%s - %s", self.address_string(), format % args)


server = ThreadingHTTPServer(("0.0.0.0", WORKER_PORT), MailRequestHandler)
logging.info("Live-Mailworker läuft auf Port %s", WORKER_PORT)
server.serve_forever()
