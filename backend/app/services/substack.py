"""Substack publishing service using python-substack."""
import logging
import datetime as _dt
import markdown

logger = logging.getLogger(__name__)


class SubstackPublisher:
    """Wraps python-substack to create drafts and publish posts."""

    def __init__(self, email: str, password: str, publication_url: str):
        from substack import Api
        self.api = Api(
            email=email,
            password=password,
            publication_url=publication_url,
        )

    def create_scheduled_draft(
        self,
        title: str,
        content_md: str,
        publish_date: _dt.date,
    ) -> tuple[str, str]:
        """Create a draft on Substack scheduled for a future date.

        Returns (draft_id, post_url).
        """
        content_html = markdown.markdown(
            content_md, extensions=["tables", "fenced_code"]
        )
        body = {
            "draft_title": title,
            "draft_body": content_html,
            "type": "newsletter",
        }
        draft = self.api.post_draft(body)
        draft_id = str(draft.get("id", ""))

        # Schedule the draft for the given date at 9am UTC
        if draft_id:
            scheduled_dt = _dt.datetime.combine(
                publish_date, _dt.time(9, 0), tzinfo=_dt.timezone.utc
            )
            self.api.schedule_draft(draft_id, scheduled_dt)

        post_url = draft.get("canonical_url", "")
        return draft_id, post_url

    def publish_now(self, title: str, content_md: str) -> str:
        """Create and immediately publish a post on Substack.

        Returns the post URL.
        """
        content_html = markdown.markdown(
            content_md, extensions=["tables", "fenced_code"]
        )
        body = {
            "draft_title": title,
            "draft_body": content_html,
            "type": "newsletter",
        }
        draft = self.api.post_draft(body)
        draft_id = str(draft.get("id", ""))
        if draft_id:
            self.api.publish_draft(draft_id)
        return draft.get("canonical_url", "")
