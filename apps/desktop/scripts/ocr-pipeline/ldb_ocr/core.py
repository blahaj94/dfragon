"""Local OCR dataset preparation. No screen capture, network upload, or label logging."""
from __future__ import annotations

from collections import Counter, defaultdict
from contextlib import contextmanager
from hashlib import sha256
from pathlib import Path, PurePosixPath
import json
import re
import shutil
import unicodedata

from PIL import Image

UPSTREAM_COMMIT = "9d5e7663a3d7035456538435fae82a1762cd3529"
LDB_COMMIT = "a18fc4b8003ae55957ab163f9617ce730c135631"
SPLITS = ("train", "val", "test")
IDENTIFIER = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}\Z")


class PipelineError(Exception):
    """An actionable error whose message must not contain image paths or labels."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise PipelineError(message)


def digest(path: Path) -> str:
    result = sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def write_json(path: Path, value: object) -> None:
    path.write_bytes(json_bytes(value))


def read_json(path: Path) -> dict:
    try:
        result = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError):
        raise PipelineError("JSON input cannot be read.") from None
    require(isinstance(result, dict), "JSON root must be an object.")
    return result


def read_dictionary(path: Path, *, allow_space: bool = False) -> list[str]:
    """Preserve exact code points and order; never strip or normalize characters."""
    try:
        text = path.read_bytes().decode("utf-8")
    except (OSError, UnicodeError):
        raise PipelineError("Dictionary cannot be read as UTF-8.") from None
    require(not text.startswith("\ufeff"), "Dictionary must not have a UTF-8 BOM.")
    entries = text.replace("\r\n", "\n").split("\n")
    if entries and entries[-1] == "":
        entries.pop()
    require(bool(entries), "Dictionary is empty.")
    require(all(len(item) == 1 for item in entries), "Dictionary needs one code point per line.")
    require(len(entries) == len(set(entries)), "Dictionary contains duplicate code points.")
    require(all(unicodedata.category(c) not in {"Cc", "Cs"} for c in entries),
            "Dictionary contains a control or surrogate code point.")
    require(allow_space or " " not in entries, "Base dictionary must exclude the automatically appended space.")
    return entries


def safe_path(root: Path, relative: str) -> Path:
    """Manifest paths are relative POSIX paths confined to the data directory."""
    require(isinstance(relative, str) and relative != "", "Image path must be a string.")
    require("\\" not in relative and ":" not in relative, "Use a relative POSIX image path.")
    pure = PurePosixPath(relative)
    require(not pure.is_absolute() and ".." not in pure.parts, "Image path escapes the dataset.")
    root = root.resolve()
    current = root
    for part in pure.parts:
        current = current / part
        require(not current.is_symlink(), "Dataset symlinks are not accepted.")
    resolved = current.resolve()
    require(resolved.is_relative_to(root), "Image path escapes the dataset.")
    require(resolved.is_file(), "Dataset image is missing.")
    return resolved


def rgb_image(path: Path) -> Image.Image:
    """Reject ambiguous alpha/animated images rather than silently changing backgrounds."""
    try:
        with Image.open(path) as image:
            require(image.format in {"PNG", "JPEG"}, "Only PNG and JPEG crops are accepted.")
            require(getattr(image, "n_frames", 1) == 1, "Animated crops are not accepted.")
            require(0 < image.width <= 4096 and 0 < image.height <= 1024,
                    "Crop dimensions exceed the supported safety limit.")
            require(image.mode in {"RGB", "L"}, "Crops must be opaque RGB or grayscale images.")
            image.load()
            return image.convert("RGB")
    except PipelineError:
        raise
    except (OSError, ValueError, Image.DecompressionBombError):
        raise PipelineError("A crop could not be decoded safely.") from None


@contextmanager
def new_directory(target: Path):
    """Reserve a new private directory; never overwrite or remove an existing output."""
    target = target.absolute()
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        target.mkdir(mode=0o700)
    except FileExistsError:
        raise PipelineError("Output already exists; select a new output directory.") from None
    try:
        yield target
    except BaseException:
        shutil.rmtree(target)
        raise


def seal_directory(root: Path) -> str:
    files = {}
    for path in sorted(root.rglob("*")):
        require(not path.is_symlink(), "Output symlinks are not accepted.")
        if path.is_file() and path.relative_to(root).as_posix() != "seal.json":
            files[path.relative_to(root).as_posix()] = digest(path)
    fingerprint = sha256(json_bytes(files)).hexdigest()
    write_json(root / "seal.json", {"schema": 1, "files": files, "fingerprint": fingerprint})
    return fingerprint


def verify_seal(root: Path) -> dict:
    seal = read_json(root / "seal.json")
    require(seal.get("schema") == 1 and isinstance(seal.get("files"), dict), "Invalid dataset seal.")
    actual = {}
    for path in sorted(root.rglob("*")):
        require(not path.is_symlink(), "Sealed data contains a symlink.")
        if path.is_file() and path.relative_to(root).as_posix() != "seal.json":
            actual[path.relative_to(root).as_posix()] = digest(path)
    require(actual == seal["files"], "Prepared dataset has changed; prepare a new snapshot.")
    require(sha256(json_bytes(actual)).hexdigest() == seal.get("fingerprint"), "Invalid dataset fingerprint.")
    return seal


def load_manifest(path: Path) -> list[dict]:
    records = []
    try:
        with path.open(encoding="utf-8") as stream:
            for line_number, line in enumerate(stream, 1):
                require(len(line) <= 65536, "Manifest record exceeds the size limit.")
                require(line.strip() != "", f"Manifest line {line_number} is empty.")
                record = json.loads(line)
                require(isinstance(record, dict), f"Manifest line {line_number} is not an object.")
                records.append(record)
    except (OSError, ValueError, UnicodeError):
        raise PipelineError("Manifest must be valid UTF-8 JSON Lines.") from None
    require(bool(records), "Manifest is empty.")
    return records


def prepare(*, source: Path, manifest: Path, base_dictionary: Path, allowed_characters: Path,
            output: Path, profiles: list[str], min_occurrences: int, max_text_length: int,
            allow_real_data: bool = False) -> dict:
    """Validate the complete supplied target alphabet and build a sealed Paddle dataset."""
    require(min_occurrences >= 1 and 1 <= max_text_length <= 128, "Invalid coverage or length setting.")
    require(bool(profiles) and len(set(profiles)) == len(profiles), "Profiles must be nonempty and unique.")
    require(all(IDENTIFIER.fullmatch(p) for p in profiles), "Profile names must be opaque identifiers.")
    require(not output.resolve().is_relative_to(source.resolve()), "Keep prepared outputs outside source data.")
    base = read_dictionary(base_dictionary)
    allowed = read_dictionary(allowed_characters, allow_space=True)
    allowed_set = set(allowed)
    added = sorted(allowed_set - set(base) - {" "}, key=ord)
    dictionary = base + added
    records = load_manifest(manifest)
    ids: set[str] = set()
    group_split: dict[str, str] = {}
    text_split: dict[str, str] = {}
    pixel_labels: dict[str, tuple[str, str]] = {}
    coverage = {p: Counter() for p in profiles}
    counts: Counter = Counter()
    prepared: list[dict] = []
    required_keys = {"id", "image", "text", "split", "group", "profile", "source"}

    with new_directory(output) as root:
        (root / "images").mkdir()
        for index, record in enumerate(records, 1):
            context = f"Record {index}: "
            require(set(record) == required_keys, context + "unexpected or missing fields.")
            require(all(isinstance(record[k], str) for k in required_keys), context + "fields must be strings.")
            sample_id, text, split = record["id"], record["text"], record["split"]
            require(bool(IDENTIFIER.fullmatch(sample_id)) and sample_id not in ids,
                    context + "invalid or duplicate sample identifier.")
            ids.add(sample_id)
            require(bool(IDENTIFIER.fullmatch(record["group"])), context + "invalid group identifier.")
            require(split in SPLITS, context + "invalid split.")
            require(record["profile"] in profiles, context + "unknown rendering profile.")
            require(record["source"] in {"synthetic", "real"}, context + "invalid source type.")
            require(record["source"] != "real" or allow_real_data, context + "real-data authorization is required.")
            require(0 < len(text) <= max_text_length, context + "label length is outside the configured limit.")
            require(set(text) <= allowed_set, context + "label contains an undeclared target character.")
            old_split = group_split.setdefault(record["group"], split)
            require(old_split == split, context + "a capture/render group crosses splits.")
            # Canonical equivalents are grouped only for leakage detection, never rewritten.
            text_key = unicodedata.normalize("NFC", text)
            old_split = text_split.setdefault(text_key, split)
            require(old_split == split, context + "the same underlying text crosses splits.")
            path = safe_path(source, record["image"])
            image = rgb_image(path)
            pixels_key = sha256(str(image.size).encode() + image.tobytes()).hexdigest()
            require(pixels_key not in pixel_labels, context + "duplicate crop pixels or conflicting labels.")
            pixel_labels[pixels_key] = (text, split)
            image_name = f"images/{sample_id}.png"
            image.save(root / image_name, format="PNG")
            image.close()
            prepared.append({**record, "image": image_name})
            counts[split] += 1
            if split == "train":
                coverage[record["profile"]].update(set(text))
        require(all(counts[s] > 0 for s in SPLITS), "Every split must contain samples.")
        for profile in profiles:
            missing = sum(coverage[profile][c] < min_occurrences for c in allowed)
            require(missing == 0, f"Training coverage is insufficient for profile {profile}; {missing} code points.")
        for split in SPLITS:
            entries = sorted((r for r in prepared if r["split"] == split), key=lambda r: r["id"])
            (root / f"{split}.txt").write_text(
                "".join(f"{r['image']}\t{r['text']}\n" for r in entries), encoding="utf-8")
        (root / "dict.txt").write_text("\n".join(dictionary) + "\n", encoding="utf-8")
        (root / "allowed.txt").write_text("\n".join(allowed) + "\n", encoding="utf-8")
        (root / "records.jsonl").write_bytes(b"".join(
            (json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
            for r in sorted(prepared, key=lambda r: r["id"])))
        info = {"schema": 1, "counts": dict(counts), "profiles": profiles,
                "max_text_length": max_text_length, "min_train_occurrences": min_occurrences,
                "target_characters": len(allowed), "model_characters": len(dictionary),
                "added_characters": len(added), "base_dictionary_sha256": digest(base_dictionary),
                "base_dictionary_codepoints_sha256": sha256("\n".join(base).encode("utf-8")).hexdigest(),
                "raw_labels_are_private": True}
        write_json(root / "dataset.json", info)
        fingerprint = seal_directory(root)
    return {**info, "fingerprint": fingerprint}
