from pathlib import Path
from copy import deepcopy
import json
import pytest
from ldb_ocr.core import PipelineError, digest, read_json, read_dictionary
from ldb_ocr.training import make_config, train, BASE_DICT_PATH, CONFIG_PATH
import ldb_ocr.training as training
import yaml


def template():
    return {"Global": {}, "Architecture": {"algorithm": "SVTR_LCNet", "Head": {
        "name": "MultiHead", "head_list": [{"CTCHead": {}}, {"NRTRHead": {"max_text_length": 25}}]}},
        "Optimizer": {"lr": {}}, "Metric": {}}


def test_generated_config_has_no_ascii_filter_or_test_set(prepared, tmp_path):
    original = template()
    before = deepcopy(original)
    config = make_config(original, data=prepared, weights=tmp_path / "weights.pdparams", run=tmp_path / "run",
                         epochs=20, batch_size=16, learning_rate=0.00005, use_gpu=False, seed=42)
    assert original == before
    assert config["Metric"]["is_filter"] is False
    assert config["Metric"]["ignore_space"] is False
    assert config["Global"]["use_space_char"] is True
    assert config["Global"]["eval_batch_step"] == [0, 1]
    assert "test.txt" not in yaml.safe_dump(config)
    assert config["Train"]["loader"]["drop_last"] is False
    assert config["Global"]["seed"] == 42


@pytest.mark.parametrize("rate", [0, -1, float("inf"), float("nan"), 1])
def test_bad_learning_rate_rejected(prepared, tmp_path, rate):
    with pytest.raises(PipelineError):
        make_config(template(), data=prepared, weights=tmp_path / "weights.pdparams", run=tmp_path / "run",
                    epochs=1, batch_size=1, learning_rate=rate, use_gpu=False, seed=0)


def train_args(inputs, prepared, monkeypatch):
    root = inputs["tmp"] / "upstream"
    (root / Path(CONFIG_PATH).parent).mkdir(parents=True)
    (root / CONFIG_PATH).write_text(yaml.safe_dump(template()))
    (root / Path(BASE_DICT_PATH).parent).mkdir(parents=True)
    (root / BASE_DICT_PATH).write_bytes(inputs["args"]["base_dictionary"].read_bytes())
    weights = inputs["tmp"] / "weights.pdparams"
    weights.write_bytes(b"fake unit-test checkpoint, not trained weights")
    monkeypatch.setattr(training, "check_upstream", lambda root: None)
    return dict(data=prepared, upstream=root, weights=weights, expected_weights_sha256=digest(weights),
                output=inputs["tmp"] / "run", epochs=1, batch_size=1, learning_rate=.00005,
                use_gpu=False, seed=1, allow_expanded_head=True)


def test_checksum_mismatch_prevents_execution(inputs, prepared, monkeypatch):
    args = train_args(inputs, prepared, monkeypatch)
    args["expected_weights_sha256"] = "0" * 64
    monkeypatch.setattr(training, "run_process", lambda *a, **k: pytest.fail("must not execute"))
    with pytest.raises(PipelineError, match="checksum"):
        train(**args)
    assert not args["output"].exists()


def test_new_alphabet_requires_explicit_head_resize_acknowledgment(inputs, prepared, monkeypatch):
    args = train_args(inputs, prepared, monkeypatch)
    args["allow_expanded_head"] = False
    with pytest.raises(PipelineError, match="classifier"):
        train(**args)


def test_subprocess_failure_is_not_reported_as_training_success(inputs, prepared, monkeypatch):
    args = train_args(inputs, prepared, monkeypatch)
    def fail(*a, **k):
        raise PipelineError("Simulated failure")
    monkeypatch.setattr(training, "run_process", fail)
    with pytest.raises(PipelineError):
        train(**args)
    assert read_json(args["output"] / "run.json")["status"] == "failed_or_interrupted"


def test_exit_zero_without_checkpoint_is_rejected(inputs, prepared, monkeypatch):
    args = train_args(inputs, prepared, monkeypatch)
    monkeypatch.setattr(training, "run_process", lambda *a, **k: None)
    with pytest.raises(PipelineError, match="best checkpoint"):
        train(**args)


def test_training_invocation_and_provenance_are_recorded(inputs, prepared, monkeypatch):
    args = train_args(inputs, prepared, monkeypatch)
    calls = []
    def simulate(command, *, cwd):
        calls.append(command)
        root = args["output"] / "checkpoints"
        root.mkdir()
        (root / "best_accuracy.pdparams").write_bytes(b"simulated checkpoint")
    monkeypatch.setattr(training, "run_process", simulate)
    result = train(**args)
    assert result["status"] == "trained"
    assert result["expanded_head"] is True
    assert calls[0][1:3] == ["tools/train.py", "-c"]
    assert read_dictionary(args["output"] / "dict.txt") == read_dictionary(prepared / "dict.txt")
