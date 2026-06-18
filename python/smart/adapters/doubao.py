import time
import os
from .base import AIProvider, AIResponse

try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


class DoubaoProvider(AIProvider):
    name = 'doubao'

    def __init__(self):
        self.api_key = os.environ.get('DOUBAO_API_KEY', '')
        self.base_url = 'https://ark.cn-beijing.volces.com/api/v3'
        self._client = None

    def _get_client(self):
        if not self._client and self.api_key and HAS_OPENAI:
            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    def chat(self, prompt: str, temperature: float = 0.3) -> AIResponse:
        client = self._get_client()
        if not client:
            raise RuntimeError('Doubao not configured')

        start = time.time()
        resp = client.chat.completions.create(
            model='doubao-lite-32k',
            messages=[{'role': 'user', 'content': prompt}],
            temperature=temperature,
            max_tokens=4096,
        )
        elapsed = (time.time() - start) * 1000

        return AIResponse(
            content=resp.choices[0].message.content,
            model='doubao-lite-32k',
            tokens_used=resp.usage.total_tokens if resp.usage else 0,
            duration_ms=elapsed,
        )

    def is_available(self) -> bool:
        return bool(self.api_key) and HAS_OPENAI
