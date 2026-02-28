import os
import time
import json
import hashlib
from groq import Groq
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Support multiple comma-separated API keys for rotation
_api_keys = [k.strip() for k in os.getenv("GROQ_API_KEY", "").split(",") if k.strip()]
_current_key_index = 0
_call_count = 0

# Rate limiting: enforce minimum gap between API calls (seconds)
_MIN_REQUEST_GAP = 2  # Groq free tier is generous, but stay safe
_last_request_time = 0.0

# Response cache: avoid re-calling for identical prompts
_response_cache: dict[str, tuple[str, float]] = {}  # hash → (response, timestamp)
_CACHE_TTL = 600  # cache responses for 10 minutes

MODEL_NAME = "llama-3.3-70b-versatile"
BROWSER_SEARCH_MODEL = "openai/gpt-oss-20b"

# Create client
_client = Groq(api_key=_api_keys[0]) if _api_keys else None


class QuotaExceededError(Exception):
    """Raised when all API keys' quota is exhausted."""
    pass


def _rotate_key():
    """Switch to the next API key. Returns True if a new key is available."""
    global _current_key_index, _client
    if len(_api_keys) <= 1:
        return False
    _current_key_index = (_current_key_index + 1) % len(_api_keys)
    _client = Groq(api_key=_api_keys[_current_key_index])
    print(f"Rotated to API key #{_current_key_index + 1}")
    return True


def _cache_key(system_prompt: str, user_prompt: str) -> str:
    """Generate a cache key from prompts."""
    raw = f"{system_prompt}|||{user_prompt}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_groq_response(system_prompt: str, user_prompt: str) -> str:
    """Call Groq Llama 3.3 70B with a system instruction and user prompt.
    Includes rate limiting, caching, retry with backoff, and key rotation."""
    global _call_count, _last_request_time

    if not _client:
        raise QuotaExceededError("No GROQ_API_KEY configured in .env")

    # --- Check cache first ---
    cache_k = _cache_key(system_prompt, user_prompt)
    if cache_k in _response_cache:
        cached_response, cached_at = _response_cache[cache_k]
        if time.time() - cached_at < _CACHE_TTL:
            print(f"\n[GROQ CACHE HIT] {datetime.now().strftime('%H:%M:%S')} — returning cached response")
            return cached_response
        else:
            del _response_cache[cache_k]  # expired

    _call_count += 1
    total_chars = len(system_prompt) + len(user_prompt)
    print(f"\n[GROQ CALL #{_call_count}] {datetime.now().strftime('%H:%M:%S')}")
    print(f"  Model: {MODEL_NAME}")
    print(f"  System prompt: {len(system_prompt)} chars")
    print(f"  User prompt: {len(user_prompt)} chars")
    print(f"  Total: {total_chars} chars (~{total_chars // 4} tokens)")

    # --- Rate limiting: wait if too soon since last call ---
    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_GAP:
        wait_time = _MIN_REQUEST_GAP - elapsed
        print(f"  Rate limiter: waiting {wait_time:.1f}s before calling API")
        time.sleep(wait_time)

    tried_keys = 0
    max_retries = 2  # retry up to 2 times on 429

    while tried_keys < len(_api_keys):
        for attempt in range(max_retries + 1):
            try:
                _last_request_time = time.time()
                chat_completion = _client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    model=MODEL_NAME,
                    temperature=0.3,
                    max_completion_tokens=1024,
                    top_p=0.9,
                )
                result = chat_completion.choices[0].message.content
                # Store in cache
                _response_cache[cache_k] = (result, time.time())
                return result
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg or "rate" in error_msg.lower() or "quota" in error_msg.lower() or "limit" in error_msg.lower()
                if is_rate_limit and attempt < max_retries:
                    backoff = (attempt + 1) * 5  # 5s, then 10s
                    print(f"  429 rate limit — retrying in {backoff}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(backoff)
                    continue
                elif is_rate_limit:
                    tried_keys += 1
                    if _rotate_key():
                        break  # break inner for-loop, continue outer while
                    raise QuotaExceededError(
                        "Rate limit exceeded. Please wait a minute before trying again."
                    )
                raise  # non-rate-limit error
        else:
            tried_keys += 1
            if not _rotate_key():
                raise QuotaExceededError(
                    "Rate limit exceeded. Please wait a minute before trying again."
                )

    raise QuotaExceededError(
        "All API keys exhausted. Please wait a minute or add more keys to GROQ_API_KEY in .env (comma-separated)."
    )


def get_groq_browser_search_response(user_query: str) -> str:
    """Call Groq with browser_search tool using openai/gpt-oss-20b model.
    Returns real-time web research with citations. No caching (results should be fresh)."""
    global _call_count, _last_request_time

    if not _client:
        raise QuotaExceededError("No GROQ_API_KEY configured in .env")

    _call_count += 1
    print(f"\n[GROQ BROWSER SEARCH #{_call_count}] {datetime.now().strftime('%H:%M:%S')}")
    print(f"  Model: {BROWSER_SEARCH_MODEL}")
    print(f"  Query: {user_query[:100]}...")

    # --- Rate limiting ---
    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_GAP:
        wait_time = _MIN_REQUEST_GAP - elapsed
        print(f"  Rate limiter: waiting {wait_time:.1f}s before calling API")
        time.sleep(wait_time)

    system_prompt = (
        "You are an expert research assistant with access to real-time web search. "
        "Use browser search to find the most relevant, up-to-date information. "
        "Summarize your findings clearly and concisely. "
        "Cite ALL sources with their URLs so the user can verify. "
        "Prefer academic papers, trusted publications, and official documentation. "
        "Structure your response with clear headings and bullet points when appropriate."
    )

    tried_keys = 0
    max_retries = 2

    while tried_keys < len(_api_keys):
        for attempt in range(max_retries + 1):
            try:
                _last_request_time = time.time()
                chat_completion = _client.chat.completions.create(
                    model=BROWSER_SEARCH_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_query},
                    ],
                    tools=[{"type": "browser_search"}],
                    temperature=0.3,
                    max_completion_tokens=8192,
                )

                message = chat_completion.choices[0].message
                finish_reason = chat_completion.choices[0].finish_reason
                print(f"  Response finish_reason: {finish_reason}")
                print(f"  Message content length: {len(message.content) if message.content else 0}")

                result = message.content

                # If content is empty (e.g. finish_reason=length), extract search
                # results from executed_tools on the *message* object and do a
                # follow-up call so the model can synthesise a proper answer.
                if not result:
                    search_context = ""
                    # executed_tools lives on the message, not the top-level response
                    executed = getattr(message, 'executed_tools', None)
                    if executed:
                        print(f"  Extracting search context from {len(executed)} executed_tools")
                        parts = []
                        for et in executed:
                            output = getattr(et, 'output', None)
                            if output:
                                parts.append(str(output))
                        search_context = "\n".join(parts)

                    if search_context:
                        # Make a follow-up call with the search results as context
                        print(f"  Making follow-up call with {len(search_context)} chars of search context")
                        _last_request_time = time.time()
                        followup = _client.chat.completions.create(
                            model=BROWSER_SEARCH_MODEL,
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_query},
                                {"role": "assistant", "content": f"I searched the web and found the following results:\n{search_context}"},
                                {"role": "user", "content": "Based on these search results, please provide a comprehensive answer to the original query with citations."},
                            ],
                            temperature=0.3,
                            max_completion_tokens=4096,
                        )
                        result = followup.choices[0].message.content

                if not result:
                    result = "Browser search returned no content. Please try rephrasing your query."

                print(f"  Browser search completed — {len(result)} chars returned")
                return result
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg or "rate" in error_msg.lower() or "quota" in error_msg.lower() or "limit" in error_msg.lower()
                if is_rate_limit and attempt < max_retries:
                    backoff = (attempt + 1) * 5
                    print(f"  429 rate limit — retrying in {backoff}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(backoff)
                    continue
                elif is_rate_limit:
                    tried_keys += 1
                    if _rotate_key():
                        break
                    raise QuotaExceededError(
                        "Rate limit exceeded. Please wait a minute before trying again."
                    )
                raise
        else:
            tried_keys += 1
            if not _rotate_key():
                raise QuotaExceededError(
                    "Rate limit exceeded. Please wait a minute before trying again."
                )

    raise QuotaExceededError(
        "All API keys exhausted. Please wait a minute or add more keys to GROQ_API_KEY in .env (comma-separated)."
    )


# Backward-compatible alias so callers don't need to change function names everywhere
get_gemini_response = get_groq_response
