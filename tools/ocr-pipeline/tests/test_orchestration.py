"""Mock engines verify orchestration only, never learned OCR performance."""
from pathlib import Path
import json
import shutil
import numpy as np
import pytest
import yaml

from ldb_ocr.core import (PipelineError, prepare, digest, read_json, write_json,
                         verify_seal, read_dictionary, load_manifest, rgb_image)
import ldb_ocr.evaluation as evaluation
import ldb_ocr.training as training
from test_training import train_args


def prepare_evaluation(inputs, monkeypatch, *, real=True, incorrect=False, parity=False):
    if real:
        for row in inputs["rows"]:
            if row["split"] == "test":
                row["source"] = "real"
    inputs["save"]()
    prepare(**inputs["args"], allow_real_data=real)
    data = inputs["args"]["output"]
    candidate = inputs["tmp"] / "candidate"
    candidate.mkdir()
    (candidate / "model.onnx").write_bytes(b"fake model for orchestration tests")
    shutil.copyfile(data / "dict.txt", candidate / "dict.txt")
    write_json(candidate / "candidate.json", {
        "dataset_fingerprint": verify_seal(data)["fingerprint"],
        "model_sha256": digest(candidate / "model.onnx"),
        "dictionary_sha256": digest(candidate / "dict.txt")})
    baseline = inputs["tmp"] / "baseline.onnx"
    baseline.write_bytes(b"fake baseline")
    dictionary = read_dictionary(data / "dict.txt")
    targets = {}
    for record in load_manifest(data / "records.jsonl"):
        image = rgb_image(data / record["image"])
        tensor = evaluation.tensor_from_image(image)
        image.close()
        targets[float(tensor[0, 2, 0, 0])] = record["text"]
    def probabilities(text):
        indices = [0]
        for char in text:
            indices.extend([dictionary.index(char) + 1, 0])
        result = np.zeros((1, len(indices), len(dictionary) + 2), dtype=np.float32)
        result[0, np.arange(len(indices)), indices] = 1
        return result
    class FakeOnnx:
        def __init__(self, model, path):
            self.dictionary = dictionary
            self.is_baseline = model == baseline
        def run(self, tensor):
            text = targets[float(tensor[0, 2, 0, 0])]
            if incorrect and not self.is_baseline:
                text = "A" + text[1:]
            return probabilities(text)
    class FakePaddle:
        def __init__(self, directory):
            pass
        def run(self, tensor):
            text = targets[float(tensor[0, 2, 0, 0])]
            if incorrect:
                text = "A" + text[1:]
            if parity:
                text = "1" + text[1:]
            return probabilities(text)
    monkeypatch.setattr(evaluation, "OnnxRecognizer", FakeOnnx)
    monkeypatch.setattr(evaluation, "PaddleRecognizer", FakePaddle)
    policy = inputs["tmp"] / "policy.json"
    write_json(policy, {"min_samples_per_group": 1, "minimum_exact_match": 1.0, "maximum_cer": 0.0,
                       "maximum_exact_match_regression": 0.0, "maximum_p95_cpu_ms": 10000,
                       "min_real_test_samples": 1, "min_test_examples_per_character_per_profile": 1,
                       "required_scripts": ["hangul", "latin", "digit", "han", "kana", "symbol"]})
    return dict(data=data, candidate=candidate, baseline_model=baseline,
                baseline_dictionary=data / "dict.txt", policy_path=policy,
                output=inputs["tmp"] / "report")


def test_successful_cpu_gate_never_approves_product_deployment(inputs, monkeypatch):
    args = prepare_evaluation(inputs, monkeypatch)
    report = evaluation.evaluate(**args)
    assert report["cpu_gate_pass"] is True
    assert report["deployment_approved"] is False
    assert report["parity_samples"] == 2
    serialized = (args["output"] / "evaluation.json").read_text()
    for row in inputs["rows"]:
        assert row["text"] not in serialized
        assert row["id"] not in serialized


def test_no_real_samples_cannot_pass_as_operational_evidence(inputs, monkeypatch):
    report = evaluation.evaluate(**prepare_evaluation(inputs, monkeypatch, real=False))
    assert report["cpu_gate_pass"] is False
    assert report["real_test_samples"] == 0


def test_wrong_unicode_and_regression_fail_the_gate(inputs, monkeypatch):
    report = evaluation.evaluate(**prepare_evaluation(inputs, monkeypatch, incorrect=True))
    assert report["quality_pass"] is False
    assert "exact_match_regression" in report["failures"]["all"]


def test_conversion_drift_fails_even_with_perfect_onnx_predictions(inputs, monkeypatch):
    report = evaluation.evaluate(**prepare_evaluation(inputs, monkeypatch, parity=True))
    assert report["quality_pass"] is True
    assert report["paddle_onnx_parity_pass"] is False
    assert report["cpu_gate_pass"] is False


def test_candidate_dictionary_changes_are_rejected(inputs, monkeypatch):
    args = prepare_evaluation(inputs, monkeypatch)
    with (args["candidate"] / "dict.txt").open("a") as stream:
        stream.write("Z\n")
    with pytest.raises(PipelineError, match="dictionary changed"):
        evaluation.evaluate(**args)


def test_model_bytes_changes_are_rejected(inputs, monkeypatch):
    args = prepare_evaluation(inputs, monkeypatch)
    (args["candidate"] / "model.onnx").write_bytes(b"changed")
    with pytest.raises(PipelineError, match="model changed"):
        evaluation.evaluate(**args)


def test_export_calls_official_tools_without_touching_app(inputs, prepared, monkeypatch):
    args = train_args(inputs, prepared, monkeypatch)
    def fake_train(command, *, cwd):
        checkpoint_dir = args["output"] / "checkpoints"
        checkpoint_dir.mkdir()
        (checkpoint_dir / "best_accuracy.pdparams").write_bytes(b"fake trained checkpoint")
    monkeypatch.setattr(training, "run_process", fake_train)
    training.train(**args)
    output = inputs["tmp"] / "exported"
    calls = []
    def fake_export(command, *, cwd):
        calls.append(command)
        if "tools/export_model.py" in command:
            directory = output / "paddle"
            directory.mkdir()
            (directory / "inference.json").write_text("{}")
            (directory / "inference.pdiparams").write_bytes(b"fake")
        else:
            (output / "model.onnx").write_bytes(b"fake ONNX")
    monkeypatch.setattr(training, "run_process", fake_export)
    monkeypatch.setattr(training.shutil, "which", lambda executable: "fake-paddle2onnx")
    result = training.export(run=args["output"], upstream=args["upstream"], output=output)
    assert len(calls) == 2
    assert "tools/export_model.py" in calls[0]
    assert "--enable_onnx_checker" in calls[1]
    assert result["deployment_approved"] is False
    assert result["status"] == "unvalidated_candidate"
