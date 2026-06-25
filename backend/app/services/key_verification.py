"""Live verification of admin-managed keys and the processing model.

Each function makes a real, cheap external call and returns ``(ok, message)``. They are
synchronous (sync SDKs / blocking HTTP) and meant to be run in a thread executor from the
async admin endpoint, so a typo is caught *before* the value is saved rather than failing
silently at job time (an unknown model otherwise routes to Anthropic and only fails when
the real article is generated).
"""
import httpx

# Model used to validate a Google key in isolation (independent of the chosen model).
_KEY_TEST_MODEL = "gemini-3.1-flash-lite"
_HTTP_TIMEOUT = 15.0
_TEST_PROMPT = "Reply with the single word: ok"


def verify_assemblyai_key(key: str) -> tuple[bool, str]:
    """Validate an AssemblyAI key with a free authenticated request (no transcription)."""
    if not key:
        return False, "No AssemblyAI key provided."
    try:
        resp = httpx.get(
            "https://api.assemblyai.com/v2/transcript",
            params={"limit": 1},
            headers={"Authorization": key},
            timeout=_HTTP_TIMEOUT,
        )
    except Exception as exc:  # network/DNS/timeout
        return False, f"Could not reach AssemblyAI: {exc}"
    if resp.status_code == 200:
        return True, "AssemblyAI key is valid."
    if resp.status_code in (401, 403):
        return False, "AssemblyAI rejected this key (unauthorized)."
    return False, f"AssemblyAI returned HTTP {resp.status_code}."


def _run_generation(model: str, google_key: str) -> tuple[bool, str]:
    """Run a trivial generation through SocraticAI's LLMChain.

    Passing the Google key as ``api_key`` means Gemini models validate against it, while a
    non-Gemini/unknown model routes to the Anthropic chain and fails at call time — exactly
    the production routing, so an unsupported model is reported as unusable.
    """
    try:
        from socraticai.core.llm import LLMChain

        chain = LLMChain(model=model, api_key=google_key)
        chain.generate(_TEST_PROMPT, max_tokens=32, temperature=0)
        return True, f"Model '{model}' responded successfully."
    except Exception as exc:
        return False, f"Test call failed: {exc}"


def verify_google_key(key: str) -> tuple[bool, str]:
    """Validate a Google key with a tiny Gemini generation on a known-good model."""
    if not key:
        return False, "No Google key provided."
    ok, message = _run_generation(_KEY_TEST_MODEL, key)
    return (True, "Google key is valid.") if ok else (False, message)


def verify_model(model: str, google_key: str) -> tuple[bool, str]:
    """Validate that `model` actually generates with the configured Google key."""
    if not model:
        return False, "No model provided."
    if not google_key:
        return False, "Save a Google API key first, then test the model."
    return _run_generation(model, google_key)
