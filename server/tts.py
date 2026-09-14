"""Озвучка через edge-tts. stdin: [{text, voice, rate, out}], stdout: [{ok, words|error}]."""
import asyncio
import json
import sys

import edge_tts


async def synth(job):
    words = []
    communicate = edge_tts.Communicate(job["text"], job["voice"], rate=job.get("rate", "+0%"), boundary="WordBoundary")
    with open(job["out"], "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append({"text": chunk["text"], "start": start, "end": start + chunk["duration"] / 1e7})
    return words


async def one(job, sem):
    async with sem:
        last = None
        for attempt in range(3):
            try:
                return {"ok": True, "words": await synth(job)}
            except Exception as e:  # сеть до сервиса Microsoft иногда моргает
                last = e
                await asyncio.sleep(1 + attempt)
        return {"ok": False, "error": str(last)}


async def main():
    jobs = json.load(sys.stdin)
    sem = asyncio.Semaphore(4)
    results = await asyncio.gather(*(one(j, sem) for j in jobs))
    json.dump(results, sys.stdout, ensure_ascii=False)


asyncio.run(main())
