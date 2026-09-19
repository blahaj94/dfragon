from pathlib import Path
import json
import pytest
from PIL import Image
from ldb_ocr.core import (PipelineError, prepare, read_dictionary, read_json,
                          verify_seal, load_manifest, safe_path)


def test_full_alphabet_and_exact_unicode_survive(inputs):
    result = prepare(**inputs["args"])
    root = inputs["args"]["output"]
    assert result["added_characters"] == 3
    assert read_dictionary(root / "dict.txt") == ["가", "A", "1", "※", "ね", "月"]
    assert "가Aね月※1A" in (root / "test.txt").read_text()
    assert verify_seal(root)["fingerprint"] == result["fingerprint"]


@pytest.mark.parametrize("content", ["", "A\nA\n", "\ufeffA\n", "AB\n", "\t\n", "\n", " \n"])
def test_invalid_dictionary(tmp_path, content):
    path = tmp_path / "dict.txt"
    path.write_text(content, encoding="utf-8")
    with pytest.raises(PipelineError):
        read_dictionary(path)


def test_dictionary_does_not_normalize_width_or_compatibility(tmp_path):
    path = tmp_path / "dict.txt"
    path.write_text("A\nＡ\n1\n①\nⅠ\nI\n", encoding="utf-8")
    assert read_dictionary(path) == ["A", "Ａ", "1", "①", "Ⅰ", "I"]


def test_space_is_explicit_in_target_dictionary(tmp_path):
    path = tmp_path / "dict.txt"
    path.write_text(" \nA\n", encoding="utf-8")
    assert read_dictionary(path, allow_space=True) == [" ", "A"]


@pytest.mark.parametrize("mutation,fragment", [
    (lambda r: r[0].update(extra=1), "fields"),
    (lambda r: r[0].update(text="PRIVATE_UNKNOWN"), "undeclared"),
    (lambda r: r[1].update(id=r[0]["id"]), "identifier"),
    (lambda r: r[2].update(group=r[0]["group"]), "group crosses"),
    (lambda r: r[2].update(text=r[0]["text"]), "text crosses"),
    (lambda r: r[2].update(image=r[0]["image"]), "duplicate crop"),
    (lambda r: r[0].update(split="production"), "split"),
    (lambda r: r[0].update(profile="unknown"), "profile"),
    (lambda r: r[0].update(source="real"), "authorization"),
    (lambda r: r[0].update(text=""), "length"),
    (lambda r: r[0].update(image="../outside.png"), "escapes"),
    (lambda r: r[0].update(image="/tmp/file.png"), "escapes"),
    (lambda r: r[0].update(image="C:\\data\\file.png"), "relative"),
])
def test_rejects_bad_records_without_leaking_labels(inputs, mutation, fragment):
    mutation(inputs["rows"])
    inputs["save"]()
    with pytest.raises(PipelineError) as error:
        prepare(**inputs["args"])
    assert fragment in str(error.value)
    assert "PRIVATE_UNKNOWN" not in str(error.value)
    assert not inputs["args"]["output"].exists()


def test_real_data_requires_explicit_authorization(inputs):
    inputs["rows"][3]["source"] = "real"
    inputs["save"]()
    prepare(**inputs["args"], allow_real_data=True)


def test_uncovered_character_fails_instead_of_partial_training(inputs):
    inputs["rows"][1]["text"] = "1※月A가"
    inputs["save"]()
    with pytest.raises(PipelineError, match="coverage"):
        prepare(**inputs["args"])


def test_alpha_crops_are_rejected(inputs):
    Image.new("RGBA", (10, 10), (255, 0, 0, 0)).save(inputs["args"]["source"] / "0.png")
    with pytest.raises(PipelineError, match="opaque"):
        prepare(**inputs["args"])


def test_oversized_crops_are_rejected(inputs):
    Image.new("RGB", (4097, 1)).save(inputs["args"]["source"] / "0.png")
    with pytest.raises(PipelineError, match="dimensions"):
        prepare(**inputs["args"])


def test_symlink_is_rejected(inputs):
    root = inputs["args"]["source"]
    (root / "0.png").unlink()
    (root / "0.png").symlink_to(root / "1.png")
    with pytest.raises(PipelineError, match="symlink"):
        prepare(**inputs["args"])


def test_existing_output_is_never_deleted(inputs):
    output = inputs["args"]["output"]
    output.mkdir()
    (output / "keep").write_text("important")
    with pytest.raises(PipelineError, match="exists"):
        prepare(**inputs["args"])
    assert (output / "keep").read_text() == "important"


def test_canonical_equivalent_labels_cannot_cross_splits(inputs):
    inputs["rows"][0]["text"] = "가A"
    inputs["rows"][2]["text"] = "가A"
    with inputs["args"]["allowed_characters"].open("a", encoding="utf-8") as stream:
        stream.write("ᄀ\nᅡ\n")
    inputs["save"]()
    with pytest.raises(PipelineError, match="text crosses"):
        prepare(**inputs["args"])


@pytest.mark.parametrize("path", ["dict.txt", "images/sample-0.png", "test.txt", "dataset.json"])
def test_snapshot_detects_modified_inputs(prepared, path):
    with (prepared / path).open("ab") as stream:
        stream.write(b"changed")
    with pytest.raises(PipelineError, match="changed"):
        verify_seal(prepared)


def test_snapshot_rejects_extra_files(prepared):
    (prepared / "unexpected.txt").write_text("x")
    with pytest.raises(PipelineError, match="changed"):
        verify_seal(prepared)


def test_all_splits_are_required(inputs):
    inputs["rows"][2]["split"] = "train"
    inputs["save"]()
    with pytest.raises(PipelineError, match="Every split"):
        prepare(**inputs["args"])
