"""Generated colored crops test tooling contracts, NOT OCR model accuracy."""
from pathlib import Path
import json
import pytest
from PIL import Image
from ldb_ocr.core import prepare


@pytest.fixture
def inputs(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    rows = []
    specifications = [
        ("train", "dotum", "가Aね月※1"),
        ("train", "neo", "1※月ねA가"),
        ("val", "dotum", "가Aね月※11"),
        ("test", "dotum", "가Aね月※1A"),
        ("test", "neo", "가Aね月※1ね"),
    ]
    for i, (split, profile, text) in enumerate(specifications):
        Image.new("RGB", (100, 18), (i * 31 + 1, 22, 233)).save(source / f"{i}.png")
        rows.append({"id": f"sample-{i}", "image": f"{i}.png", "text": text,
                     "split": split, "group": f"group-{i}", "profile": profile, "source": "synthetic"})
    manifest = tmp_path / "manifest.jsonl"
    base = tmp_path / "base.txt"
    base.write_text("가\nA\n1\n", encoding="utf-8")
    allowed = tmp_path / "allowed.txt"
    allowed.write_text("가\nA\nね\n月\n※\n1\n", encoding="utf-8")
    def save():
        manifest.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    save()
    args = dict(source=source, manifest=manifest, base_dictionary=base, allowed_characters=allowed,
                output=tmp_path / "prepared", profiles=["dotum", "neo"], min_occurrences=1, max_text_length=25)
    return {"args": args, "rows": rows, "save": save, "tmp": tmp_path}


@pytest.fixture
def prepared(inputs):
    prepare(**inputs["args"])
    return inputs["args"]["output"]
