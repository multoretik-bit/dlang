"""Озвучка всех слов и примеров нейроголосами Microsoft (edge-tts).

audio/<lang>/<id>.mp3  — слово (для испанских существительных — с артиклем)
audio/<lang>/<id>x.mp3 — пример
audio/<lang>/verbs/<id>.mp3 — три формы неправильного глагола
Уже готовые файлы пропускаются, так что скрипт можно перезапускать.

    pip install edge-tts
    python tools/make_audio.py [en|es]
"""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
VOICES = {"en": "en-US-AvaNeural", "es": "es-ES-ElviraNeural"}
PARALLEL = 8


async def one(sem, voice, text, path, rate):
    if path.exists() and path.stat().st_size > 1000:
        return True
    async with sem:
        for attempt in range(4):
            try:
                tmp = path.with_suffix(".part")
                await edge_tts.Communicate(text, voice, rate=rate).save(str(tmp))
                tmp.replace(path)
                return True
            except Exception as e:  # сеть/лимиты — подождать и повторить
                if attempt == 3:
                    print("  !", path.name, text, e)
                await asyncio.sleep(2 + attempt * 3)
    return False


async def run(lang):
    data = json.loads((ROOT / "data" / f"{lang}.json").read_text(encoding="utf-8"))
    out = ROOT / "audio" / lang
    out.mkdir(parents=True, exist_ok=True)
    voice, sem = VOICES[lang], asyncio.Semaphore(PARALLEL)
    jobs = []
    for wid, w, ipa, pos, t, lvl, cat, ex, exr in data["words"]:
        jobs.append(one(sem, voice, w, out / f"{wid}.mp3", "-5%"))
        if ex:
            jobs.append(one(sem, voice, ex, out / f"{wid}x.mp3", "-5%"))
    verbs = ROOT / "data" / f"verbs-{lang}.json"
    if verbs.exists():  # три формы глагола одной записью: «go, went, gone»
        (out / "verbs").mkdir(exist_ok=True)
        for vid, v1, v2, v3, t, tier in json.loads(verbs.read_text(encoding="utf-8"))["verbs"]:
            text = ", ".join(f.replace("/", " or ") for f in (v1, v2, v3))
            jobs.append(one(sem, voice, text, out / "verbs" / f"{vid}.mp3", "-10%"))
    done = 0
    for i, coro in enumerate(asyncio.as_completed(jobs), 1):
        done += bool(await coro)
        if i % 200 == 0 or i == len(jobs):
            print(f"{lang}: {i}/{len(jobs)}", flush=True)
    print(f"{lang}: готово {done}/{len(jobs)}")


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["en", "es"]:
        asyncio.run(run(lang))
