from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class AIResponse:
    content: str
    model: str
    tokens_used: int
    duration_ms: float


class AIProvider(ABC):
    @abstractmethod
    def chat(self, prompt: str, temperature: float = 0.3) -> AIResponse:
        ...

    @abstractmethod
    def is_available(self) -> bool:
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        ...
