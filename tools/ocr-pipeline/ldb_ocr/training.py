"""Invoke the official pinned PaddleOCR trainer, not a reimplementation of its model."""
from __future__ import annotations
from copy import deepcopy
from pathlib import Path
from importlib import metadata
import os
import re
import signal
import shutil
import subprocess
import sys
import yaml

from .core import (UPSTREAM_COMMIT, PipelineError, require, digest, read_json, write_json,
                   read_dictionary, verify_seal, new_directory)

CONFIG_PATH = "configs/rec/PP-OCRv5/multi_language/korean_PP-OCRv5_mobile_rec.yml"
BASE_DICT_PATH = "ppocr/utils/dict/ppocrv5_korean_dict.txt"


def check_upstream(root: Path) -> None:
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, check=True,
                              capture_output=True, text=True).stdout.strip()
        status = subprocess.run(["git", "status", "--porcelain", "--untracked-files=normal"],
                                cwd=root, check=True, capture_output=True, text=True).stdout
    except (OSError, subprocess.SubprocessError):
        raise PipelineError("PaddleOCR checkout could not be inspected.") from None
    require(head == UPSTREAM_COMMIT, "PaddleOCR checkout does not match the pinned commit.")
    require(not status.strip(), "PaddleOCR checkout is not clean; keep data and runs outside it.")


def installed_versions() -> dict[str, str]:
    versions = {"python": sys.version.split()[0]}
    for name in ("paddlepaddle", "paddlepaddle-gpu", "paddle2onnx", "numpy", "Pillow", "PyYAML", "onnxruntime", "onnx"):
        try:
            versions[name] = metadata.version(name)
        except metadata.PackageNotFoundError:
            pass
    return versions


def run_process(command: list[str], *, cwd: Path) -> None:
    """Do not forward subprocess logs, which can contain private paths or labels."""
    environment = dict(os.environ)
    environment.pop("PYTHONPATH", None)
    environment["PYTHONUNBUFFERED"] = "1"
    options = {"start_new_session": True} if os.name == "posix" else {
        "creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    try:
        process = subprocess.Popen(command, cwd=cwd, env=environment,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **options)
    except OSError:
        raise PipelineError("External program could not be started.") from None
    try:
        code = process.wait()
    except BaseException:
        if process.poll() is None:
            if os.name == "posix":
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
                except ProcessLookupError:
                    process.wait()
            else:
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
                process.wait(timeout=10)
        raise
    require(code == 0, f"External program failed with exit code {code}; private logs were not forwarded.")


def make_config(template: dict, *, data: Path, weights: Path, run: Path, epochs: int,
                batch_size: int, learning_rate: float, use_gpu: bool, seed: int) -> dict:
    import math
    require(type(epochs) is int and epochs >= 1, "Epochs must be positive.")
    require(type(batch_size) is int and 1 <= batch_size <= 1024, "Invalid batch size.")
    require(math.isfinite(learning_rate) and 0 < learning_rate < 1, "Invalid learning rate.")
    require(type(seed) is int and 0 <= seed < 2**32, "Invalid seed.")
    info = read_json(data / "dataset.json")
    config = deepcopy(template)
    require(config.get("Architecture", {}).get("algorithm") == "SVTR_LCNet", "Unexpected model architecture.")
    require(config["Architecture"]["Head"]["name"] == "MultiHead", "Unexpected recognition heads.")
    config["Global"].update({
        "pretrained_model": str(weights.resolve()), "checkpoints": None,
        "save_model_dir": str((run / "checkpoints").resolve()),
        "character_dict_path": str((data / "dict.txt").resolve()),
        "use_space_char": True, "use_gpu": use_gpu, "epoch_num": epochs,
        "seed": seed, "use_visualdl": False, "save_epoch_step": 1,
        "eval_batch_step": [0, max(1, info["counts"]["train"] // batch_size)],
        "max_text_length": info["max_text_length"], "distributed": False,
        "cal_metric_during_train": True, "d2s_train_image_shape": [3, 48, 320],
    })
    for head in config["Architecture"]["Head"]["head_list"]:
        if "NRTRHead" in head:
            head["NRTRHead"]["max_text_length"] = info["max_text_length"]
    config["Optimizer"]["lr"]["learning_rate"] = learning_rate
    config["Optimizer"]["lr"]["warmup_epoch"] = min(1, epochs)
    config["Metric"] = {"name": "RecMetric", "main_indicator": "acc", "is_filter": False, "ignore_space": False}
    # Use the official resize/label operators. No dictionary correction or image concatenation.
    # Width 320 is the training shape; the ONNX evaluator separately covers dynamic runtime widths.
    for mode, split in (("Train", "train"), ("Eval", "val")):
        config[mode] = {
            "dataset": {
                "name": "SimpleDataSet", "data_dir": str(data.resolve()),
                "label_file_list": [str((data / f"{split}.txt").resolve())],
                "transforms": [
                    {"DecodeImage": {"img_mode": "BGR", "channel_first": False}},
                    {"MultiLabelEncode": {"gtc_encode": "NRTRLabelEncode"}},
                    {"RecResizeImg": {"image_shape": [3, 48, 320]}},
                    {"KeepKeys": {"keep_keys": ["image", "label_ctc", "label_gtc", "length", "valid_ratio"]}},
                ],
            },
            "loader": {"shuffle": mode == "Train", "drop_last": False,
                       "batch_size_per_card": batch_size, "num_workers": 0},
        }
    return config


def train(*, data: Path, upstream: Path, weights: Path, expected_weights_sha256: str,
          output: Path, epochs: int, batch_size: int, learning_rate: float, use_gpu: bool,
          seed: int, allow_expanded_head: bool = False) -> dict:
    check_upstream(upstream)
    seal = verify_seal(data)
    info = read_json(data / "dataset.json")
    require(re.fullmatch(r"[0-9a-f]{64}", expected_weights_sha256) is not None, "Provide an expected weights SHA-256.")
    require(weights.is_file() and weights.suffix == ".pdparams", "Supply the training .pdparams checkpoint.")
    require(digest(weights) == expected_weights_sha256, "Pretrained weights checksum does not match.")
    upstream_chars = read_dictionary(upstream / BASE_DICT_PATH)
    from hashlib import sha256
    require(sha256("\n".join(upstream_chars).encode()).hexdigest() == info["base_dictionary_codepoints_sha256"],
            "The base dictionary does not match the pinned Korean training model.")
    require(info["added_characters"] == 0 or allow_expanded_head,
            "New characters require explicit acceptance of resized/reinitialized classifier weights.")
    require(not output.resolve().is_relative_to(data.resolve()), "Keep training outputs outside the dataset.")
    require(not output.resolve().is_relative_to(upstream.resolve()), "Keep runs outside the upstream checkout.")
    with new_directory(output) as run:
        template = yaml.safe_load((upstream / CONFIG_PATH).read_text(encoding="utf-8"))
        config = make_config(template, data=data, weights=weights, run=run, epochs=epochs,
                             batch_size=batch_size, learning_rate=learning_rate, use_gpu=use_gpu, seed=seed)
        config_path = run / "config.yml"
        config_path.write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False), encoding="utf-8")
        shutil.copyfile(data / "dict.txt", run / "dict.txt")
        record = {"schema": 1, "paddleocr_commit": UPSTREAM_COMMIT,
                  "dataset_fingerprint": seal["fingerprint"], "weights_sha256": expected_weights_sha256,
                  "dictionary_sha256": digest(run / "dict.txt"), "config_sha256": digest(config_path),
                  "environment": installed_versions(), "status": "prepared", "expanded_head": bool(info["added_characters"])}
        write_json(run / "run.json", record)
    # Preserve failed/interrupted run artifacts for local recovery; do not auto-resume another run.
    try:
        run_process([sys.executable, "tools/train.py", "-c", str(config_path)], cwd=upstream)
        require((run / "checkpoints" / "best_accuracy.pdparams").is_file(),
                "Training returned without an evaluated best checkpoint.")
        require(verify_seal(data)["fingerprint"] == seal["fingerprint"], "Dataset changed during training.")
        require(digest(weights) == expected_weights_sha256, "Pretrained weights changed during training.")
        record["status"] = "trained"
    except BaseException:
        record["status"] = "failed_or_interrupted"
        write_json(run / "run.json", record)
        raise
    record["checkpoint_sha256"] = digest(run / "checkpoints" / "best_accuracy.pdparams")
    write_json(run / "run.json", record)
    return record


def export(*, run: Path, upstream: Path, output: Path, opset: int = 17) -> dict:
    check_upstream(upstream)
    record = read_json(run / "run.json")
    require(record.get("schema") == 1 and record.get("paddleocr_commit") == UPSTREAM_COMMIT, "Unexpected training provenance.")
    require(record.get("status") == "trained", "Export requires a completed training run.")
    require(digest(run / "config.yml") == record["config_sha256"], "Training config changed.")
    require(digest(run / "dict.txt") == record["dictionary_sha256"], "Training dictionary changed.")
    checkpoint = run / "checkpoints" / "best_accuracy.pdparams"
    require(digest(checkpoint) == record["checkpoint_sha256"], "Selected checkpoint changed.")
    executable = shutil.which("paddle2onnx")
    require(executable is not None, "Install Paddle2ONNX in the training environment.")
    require(11 <= opset <= 21, "Unsupported ONNX opset setting.")
    with new_directory(output) as candidate:
        config = yaml.safe_load((run / "config.yml").read_text(encoding="utf-8"))
        config["Global"]["character_dict_path"] = str((run / "dict.txt").resolve())
        config["Global"]["pretrained_model"] = str(checkpoint.resolve())
        config["Global"]["save_inference_dir"] = str((candidate / "paddle").resolve())
        config_path = candidate / "export.yml"
        config_path.write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False), encoding="utf-8")
        run_process([sys.executable, "tools/export_model.py", "-c", str(config_path)], cwd=upstream)
        models = [p for p in (candidate / "paddle").iterdir() if p.suffix in {".json", ".pdmodel"}]
        params = list((candidate / "paddle").glob("*.pdiparams"))
        require(len(models) == len(params) == 1, "Unexpected exported Paddle model layout.")
        run_process([executable, "--model_dir", str(candidate / "paddle"),
                     "--model_filename", models[0].name, "--params_filename", params[0].name,
                     "--save_file", str(candidate / "model.onnx"), "--opset_version", str(opset),
                     "--enable_onnx_checker", "True"], cwd=upstream)
        require((candidate / "model.onnx").is_file(), "ONNX export produced no model.")
        shutil.copyfile(run / "dict.txt", candidate / "dict.txt")
        report = {"schema": 1, "dataset_fingerprint": record["dataset_fingerprint"],
                  "model_sha256": digest(candidate / "model.onnx"),
                  "dictionary_sha256": digest(candidate / "dict.txt"),
                  "checkpoint_sha256": record["checkpoint_sha256"],
                  "paddleocr_commit": UPSTREAM_COMMIT, "environment": installed_versions(),
                  "status": "unvalidated_candidate", "deployment_approved": False}
        write_json(candidate / "candidate.json", report)
    return report
