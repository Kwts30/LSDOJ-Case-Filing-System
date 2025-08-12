"""Type hints for external libraries."""
from typing import Any, List, Optional, Protocol, Sequence, Union
from io import BytesIO

class DiscordChannel(Protocol):
    """Type hint for Discord TextChannel."""
    async def send(self, content: str, file: Any = None) -> Any: ...
    
class DiscordBot(Protocol):
    """Type hint for Discord Bot."""
    async def start(self, token: str) -> None: ...
    def get_channel(self, channel_id: int) -> Optional[DiscordChannel]: ...
    
class DiscordFile:
    """Type hint for Discord File."""
    def __init__(self, fp: Union[str, bytes, BytesIO], filename: str = None) -> None: ...
