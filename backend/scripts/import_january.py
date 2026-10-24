from __future__ import annotations

import asyncio
import json

from app.ingest import import_january


if __name__ == "__main__":
    result = asyncio.run(import_january())
    print(json.dumps(result, indent=2))

