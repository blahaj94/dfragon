import json
import numpy as np
import pytest
from PIL import Image
from ldb_ocr.core import PipelineError
from ldb_ocr.evaluation import (decode_ctc, tensor_from_image, edit_distance, script_groups,
                                Metrics, read_policy, policy_failures)


def one_hot(indices, classes):
    result = np.zeros((1, len(indices), classes), dtype=np.float32)
    result[0, np.arange(len(indices)), indices] = 1
    return result


def test_ctc_blank_separates_repeats_and_preserves_mixed_scripts():
    dictionary = ["가", "A", "ね", "月", "※"]
    data = one_hot([1, 1, 0, 1, 2, 3, 4, 5, 6], len(dictionary) + 2)
    assert decode_ctc(data, dictionary) == "가가Aね月※ "


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -1.0, 2.0])
def test_bad_probabilities_are_rejected(value):
    data = one_hot([1], 3)
    data[0, 0, 1] = value
    with pytest.raises(PipelineError):
        decode_ctc(data, ["A"])


def test_wrong_class_count_is_rejected():
    with pytest.raises(PipelineError, match="dictionary"):
        decode_ctc(one_hot([1], 4), ["A"])


def test_logits_are_not_mistaken_for_probabilities():
    with pytest.raises(PipelineError, match="sum"):
        decode_ctc(np.zeros((1, 1, 3), dtype=np.float32), ["A"])


def test_preprocessing_bgr_padding_dtype_and_shape():
    image = Image.new("RGB", (1, 2), (255, 0, 0))
    tensor = tensor_from_image(image)
    assert tensor.shape == (1, 3, 48, 320)
    assert tensor.dtype == np.float32
    np.testing.assert_array_equal(tensor[0, :, 0, 0], [-1, -1, 1])
    assert np.all(tensor[:, :, :, 24:] == 0)


def test_runtime_width_preserves_aspect_ratio():
    tensor = tensor_from_image(Image.new("RGB", (1000, 48)))
    assert tensor.shape == (1, 3, 48, 1000)


@pytest.mark.parametrize("expected,actual", [("①", "1"), ("A", "a"), ("Ａ", "A"), ("月", "目"), ("ね", "れ")])
def test_exact_unicode_comparison_does_not_fold_identifiers(expected, actual):
    assert edit_distance(expected, actual) == 1
    metric = Metrics()
    metric.add(expected, actual, 10)
    assert metric.report()["exact_match"] == 0
    assert metric.report()["cer"] == 1


def test_insertion_deletion_distance():
    assert edit_distance("ABC", "AC") == 1
    assert edit_distance("", "abc") == 3
    assert edit_distance("abc", "") == 3
    assert edit_distance("가ね月", "가ね月") == 0


def test_required_language_groups():
    assert script_groups("가Aね月※1") == {"hangul", "latin", "kana", "han", "symbol", "digit"}


def policy():
    return {"min_samples_per_group": 10, "minimum_exact_match": .99, "maximum_cer": .01,
            "maximum_exact_match_regression": 0.0, "maximum_p95_cpu_ms": 100,
            "min_real_test_samples": 10, "min_test_examples_per_character_per_profile": 1,
            "required_scripts": ["hangul", "latin", "han", "kana", "symbol"]}


def test_regression_and_absolute_accuracy_are_separate():
    candidate = {"samples": 10, "exact_match": .995, "cer": .005, "p95_cpu_ms": 10}
    baseline = {**candidate, "exact_match": 1.0}
    assert policy_failures(candidate, baseline, policy()) == ["exact_match_regression"]


def test_policy_rejects_insufficient_evidence_even_with_perfect_predictions():
    candidate = {"samples": 2, "exact_match": 1.0, "cer": 0, "p95_cpu_ms": 10}
    assert policy_failures(candidate, candidate, policy()) == ["insufficient_samples"]


@pytest.mark.parametrize("key,value", [("min_real_test_samples", 0), ("minimum_exact_match", float("nan")),
                                       ("maximum_cer", True), ("required_scripts", []),
                                       ("maximum_p95_cpu_ms", -1)])
def test_invalid_policy_is_rejected(tmp_path, key, value):
    data = policy()
    data[key] = value
    path = tmp_path / "policy.json"
    path.write_text(json.dumps(data))
    with pytest.raises(PipelineError):
        read_policy(path)
