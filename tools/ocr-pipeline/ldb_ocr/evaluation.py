"""Exact-Unicode, held-out evaluation and Paddle-to-ONNX numerical parity checks.

This CPU reference uses Pillow resizing. It is deliberately NOT a claim of
byte-identical Electron Canvas / ONNX Runtime Web behavior or deployment approval.
"""
from __future__ import annotations
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from time import perf_counter
import math
import unicodedata

import numpy as np
from PIL import Image

from .core import (PipelineError, require, read_dictionary, read_json, write_json,
                   verify_seal, load_manifest, safe_path, rgb_image, digest, new_directory)
from .training import installed_versions


def tensor_from_image(image: Image.Image) -> np.ndarray:
    width = math.ceil(48 * image.width / image.height)
    require(1 <= width <= 4096, "Resized crop width exceeds the runtime safety limit.")
    resized = image.resize((width, 48), Image.Resampling.BILINEAR)
    rgb = np.asarray(resized.convert("RGB"), dtype=np.float32)
    bgr = rgb[:, :, ::-1] / np.float32(127.5) - np.float32(1)
    tensor = np.zeros((1, 3, 48, max(320, width)), dtype=np.float32)
    tensor[0, :, :, :width] = bgr.transpose(2, 0, 1)
    return tensor


def decode_ctc(probabilities: np.ndarray, dictionary: list[str]) -> str:
    """Dictionary excludes blank and space; output is never normalized or filtered."""
    require(probabilities.ndim == 3 and probabilities.shape[0] == 1,
            "Expected a [1, time, classes] model output.")
    characters = dictionary + [" "]
    require(probabilities.shape[2] == len(characters) + 1 and probabilities.shape[1] > 0,
            "Model output does not match its dictionary.")
    require(bool(np.isfinite(probabilities).all()), "Model output contains non-finite values.")
    require(bool((probabilities >= -1e-6).all() and (probabilities <= 1 + 1e-6).all()),
            "Expected CTC probabilities, not unnormalized logits.")
    require(bool(np.allclose(probabilities.sum(axis=2), 1, rtol=1e-3, atol=1e-3)),
            "CTC class probabilities do not sum to one.")
    previous = -1
    result = []
    for index in np.argmax(probabilities[0], axis=1).tolist():
        if index != 0 and index != previous:
            result.append(characters[index - 1])
        previous = index
    return "".join(result)


def edit_distance(expected: str, actual: str) -> int:
    previous = list(range(len(actual) + 1))
    for row, expected_char in enumerate(expected, 1):
        current = [row]
        for column, actual_char in enumerate(actual, 1):
            current.append(min(current[-1] + 1, previous[column] + 1,
                               previous[column - 1] + (expected_char != actual_char)))
        previous = current
    return previous[-1]


def script_groups(text: str) -> set[str]:
    result = set()
    for char in text:
        name = unicodedata.name(char, "")
        if "HANGUL" in name:
            result.add("hangul")
        if "LATIN" in name:
            result.add("latin")
        if "CJK" in name and "IDEOGRAPH" in name:
            result.add("han")
        if "HIRAGANA" in name or "KATAKANA" in name:
            result.add("kana")
        if unicodedata.category(char)[0] in {"P", "S"}:
            result.add("symbol")
        if unicodedata.category(char) == "Nd":
            result.add("digit")
    return result


@dataclass
class Metrics:
    count: int = 0
    correct: int = 0
    characters: int = 0
    edits: int = 0
    latency_ms: list[float] = field(default_factory=list)

    def add(self, expected: str, actual: str, milliseconds: float) -> None:
        self.count += 1
        self.correct += expected == actual
        self.characters += len(expected)
        self.edits += edit_distance(expected, actual)
        self.latency_ms.append(milliseconds)

    def report(self) -> dict:
        return {"samples": self.count,
                "exact_match": self.correct / self.count if self.count else 0.0,
                "cer": self.edits / self.characters if self.characters else 0.0,
                "p95_cpu_ms": float(np.percentile(self.latency_ms, 95)) if self.latency_ms else 0.0}


class OnnxRecognizer:
    def __init__(self, model: Path, dictionary: Path):
        try:
            import onnxruntime as ort
        except ImportError:
            raise PipelineError("Install the evaluation dependencies to use ONNX Runtime.") from None
        self.dictionary = read_dictionary(dictionary)
        options = ort.SessionOptions()
        options.log_severity_level = 3
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        try:
            self.session = ort.InferenceSession(str(model), sess_options=options,
                                                providers=["CPUExecutionProvider"])
        except Exception:
            raise PipelineError("ONNX Runtime could not load the model.") from None
        inputs = self.session.get_inputs()
        outputs = self.session.get_outputs()
        require(len(inputs) == len(outputs) == 1, "Expected one recognition input and one CTC output.")
        shape = inputs[0].shape
        require(inputs[0].type == "tensor(float)" and len(shape) == 4,
                "Expected a float32 NCHW input.")
        require(shape[1] == 3 and shape[2] == 48, "Expected a three-channel, height-48 model.")
        require(not isinstance(shape[3], int), "LDB deployment needs a model with dynamic input width.")
        self.input_name = inputs[0].name
        self.output_name = outputs[0].name

    def run(self, tensor: np.ndarray) -> np.ndarray:
        try:
            result = self.session.run([self.output_name], {self.input_name: tensor})[0]
        except Exception:
            raise PipelineError("ONNX inference failed; raw exception was not forwarded.") from None
        decode_ctc(result, self.dictionary)
        return result


class PaddleRecognizer:
    def __init__(self, directory: Path):
        try:
            from paddle import inference
        except ImportError:
            raise PipelineError("Numerical parity requires PaddlePaddle in this environment.") from None
        models = [p for p in directory.iterdir() if p.suffix in {".json", ".pdmodel"}]
        params = list(directory.glob("*.pdiparams"))
        require(len(models) == len(params) == 1, "Unexpected Paddle inference model files.")
        try:
            config = inference.Config(str(models[0]), str(params[0]))
            config.disable_gpu()
            config.disable_glog_info()
            config.set_cpu_math_library_num_threads(1)
            self.predictor = inference.create_predictor(config)
            input_names = self.predictor.get_input_names()
            output_names = self.predictor.get_output_names()
            require(len(input_names) == len(output_names) == 1, "Expected one Paddle input and CTC output.")
            self.input = self.predictor.get_input_handle(input_names[0])
            self.output = self.predictor.get_output_handle(output_names[0])
        except PipelineError:
            raise
        except Exception:
            raise PipelineError("Paddle inference model could not be initialized.") from None

    def run(self, tensor: np.ndarray) -> np.ndarray:
        try:
            self.input.reshape(tensor.shape)
            self.input.copy_from_cpu(tensor)
            self.predictor.run()
            return self.output.copy_to_cpu()
        except Exception:
            raise PipelineError("Paddle parity inference failed.") from None


def read_policy(path: Path) -> dict:
    policy = read_json(path)
    required = {"min_samples_per_group", "minimum_exact_match", "maximum_cer",
                "maximum_exact_match_regression", "maximum_p95_cpu_ms", "min_real_test_samples",
                "min_test_examples_per_character_per_profile", "required_scripts"}
    require(set(policy) == required, "Evaluation policy has missing or unexpected fields.")
    for name in ("min_samples_per_group", "min_real_test_samples", "min_test_examples_per_character_per_profile"):
        require(type(policy[name]) is int and policy[name] >= 1, "Policy sample minima must be positive integers.")
    for name in ("minimum_exact_match", "maximum_cer", "maximum_exact_match_regression", "maximum_p95_cpu_ms"):
        value = policy[name]
        require(type(value) in {int, float} and math.isfinite(value), "Policy thresholds must be finite numbers.")
        require(value > 0 if name == "maximum_p95_cpu_ms" else 0 <= value <= 1,
                "Policy threshold is outside its permitted range.")
    require(isinstance(policy["required_scripts"], list) and bool(policy["required_scripts"]),
            "Declare the script groups required in the product.")
    require(all(isinstance(s, str) and s in {"hangul", "latin", "han", "kana", "symbol", "digit"}
                for s in policy["required_scripts"]), "Unknown script group in policy.")
    require(len(set(policy["required_scripts"])) == len(policy["required_scripts"]), "Duplicate script group.")
    return policy


def policy_failures(candidate: dict, baseline: dict, policy: dict) -> list[str]:
    failures = []
    if candidate["samples"] < policy["min_samples_per_group"]:
        failures.append("insufficient_samples")
    if candidate["exact_match"] < policy["minimum_exact_match"]:
        failures.append("exact_match_below_target")
    if candidate["cer"] > policy["maximum_cer"]:
        failures.append("cer_above_target")
    if baseline["exact_match"] - candidate["exact_match"] > policy["maximum_exact_match_regression"] + 1e-12:
        failures.append("exact_match_regression")
    if candidate["p95_cpu_ms"] > policy["maximum_p95_cpu_ms"]:
        failures.append("cpu_latency_above_target")
    return failures


def evaluate(*, data: Path, candidate: Path, baseline_model: Path, baseline_dictionary: Path,
             policy_path: Path, output: Path) -> dict:
    seal = verify_seal(data)
    dataset = read_json(data / "dataset.json")
    candidate_info = read_json(candidate / "candidate.json")
    require(candidate_info.get("dataset_fingerprint") == seal["fingerprint"],
            "Candidate and evaluation dataset provenance differ.")
    require(digest(candidate / "model.onnx") == candidate_info["model_sha256"], "Candidate model changed.")
    require(digest(candidate / "dict.txt") == candidate_info["dictionary_sha256"], "Candidate dictionary changed.")
    require(digest(data / "dict.txt") == digest(candidate / "dict.txt"), "Dataset and candidate dictionaries differ.")
    policy = read_policy(policy_path)
    records = [r for r in load_manifest(data / "records.jsonl") if r["split"] == "test"]
    require(bool(records), "Held-out test split is empty.")
    current = OnnxRecognizer(candidate / "model.onnx", candidate / "dict.txt")
    baseline = OnnxRecognizer(baseline_model, baseline_dictionary)
    original = PaddleRecognizer(candidate / "paddle")
    candidate_metrics = defaultdict(Metrics)
    baseline_metrics = defaultdict(Metrics)
    coverage = {p: Counter() for p in dataset["profiles"]}
    parity_pass = True
    maximum_difference = 0.0
    real_count = 0
    for index, record in enumerate(records):
        image = rgb_image(safe_path(data, record["image"]))
        tensor = tensor_from_image(image)
        image.close()
        if index == 0:
            current.run(tensor)
            baseline.run(tensor)
            original.run(tensor)
        started = perf_counter()
        probabilities = current.run(tensor)
        prediction = decode_ctc(probabilities, current.dictionary)
        elapsed = (perf_counter() - started) * 1000
        reference = original.run(tensor)
        if reference.shape != probabilities.shape or not np.isfinite(reference).all():
            parity_pass = False
        else:
            maximum_difference = max(maximum_difference, float(np.max(np.abs(reference - probabilities))))
            parity_pass = parity_pass and bool(np.allclose(reference, probabilities, rtol=1e-4, atol=1e-5))
            parity_pass = parity_pass and decode_ctc(reference, current.dictionary) == prediction
        started = perf_counter()
        baseline_prediction = decode_ctc(baseline.run(tensor), baseline.dictionary)
        baseline_elapsed = (perf_counter() - started) * 1000
        expected = record["text"]
        groups = {"all", "profile:" + record["profile"], "source:" + record["source"]}
        groups.update("script:" + script for script in script_groups(expected))
        for group in groups:
            candidate_metrics[group].add(expected, prediction, elapsed)
            baseline_metrics[group].add(expected, baseline_prediction, baseline_elapsed)
        coverage[record["profile"]].update(set(expected))
        real_count += record["source"] == "real"
    required = {"all", "source:real"}
    required.update("profile:" + p for p in dataset["profiles"])
    required.update("script:" + s for s in policy["required_scripts"])
    groups_report = {}
    failures = {}
    for group in sorted(required | set(candidate_metrics)):
        current_report = candidate_metrics[group].report()
        base_report = baseline_metrics[group].report()
        groups_report[group] = {"candidate": current_report, "baseline": base_report}
        # Check all observed groups, not just those listed as mandatory.
        reasons = policy_failures(current_report, base_report, policy)
        if reasons:
            failures[group] = reasons
    allowed = read_dictionary(data / "allowed.txt", allow_space=True)
    uncovered = {p: sum(coverage[p][c] < policy["min_test_examples_per_character_per_profile"] for c in allowed)
                 for p in dataset["profiles"]}
    quality_pass = not failures and not any(uncovered.values()) and real_count >= policy["min_real_test_samples"]
    require(verify_seal(data)["fingerprint"] == seal["fingerprint"], "Dataset changed during evaluation.")
    report = {"schema": 1, "runtime": "python-onnxruntime-cpu", "environment": installed_versions(),
              "candidate_model_sha256": digest(candidate / "model.onnx"),
              "baseline_model_sha256": digest(baseline_model), "baseline_dictionary_sha256": digest(baseline_dictionary),
              "dataset_fingerprint": seal["fingerprint"], "policy": policy,
              "groups": groups_report, "failures": failures, "uncovered_target_codepoints_per_profile": uncovered,
              "real_test_samples": real_count, "quality_pass": quality_pass,
              "paddle_onnx_parity_pass": parity_pass, "parity_samples": len(records),
              "maximum_absolute_output_difference": maximum_difference,
              "cpu_gate_pass": quality_pass and parity_pass,
              "latency_scope": "warm inference plus CTC decode; disk/image resize excluded",
              "preprocessing": "Pillow bilinear, BGR [-1,1], height48, zero padding, min width320",
              "deployment_approved": False,
              "remaining_gate": "Actual LDB Electron Canvas/ONNX Runtime Web, search input preservation, and Stop/late-result tests"}
    with new_directory(output) as root:
        write_json(root / "evaluation.json", report)
    return report
