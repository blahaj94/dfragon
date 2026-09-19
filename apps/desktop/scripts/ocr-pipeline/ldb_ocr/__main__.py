"""CLI boundaries never print supplied labels, image paths, or raw library errors."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys
from .core import PipelineError, prepare
from .training import train, export
from .evaluation import evaluate


def main() -> int:
    parser = argparse.ArgumentParser(prog="pnpm --filter @ldb/desktop ocr")
    commands = parser.add_subparsers(dest="command", required=True)
    command = commands.add_parser("prepare", help="Validate all declared target characters and seal a dataset")
    for name in ("source", "manifest", "base-dictionary", "allowed-characters", "output"):
        command.add_argument("--" + name, required=True, type=Path)
    command.add_argument("--profiles", required=True, nargs="+")
    command.add_argument("--min-occurrences", required=True, type=int)
    command.add_argument("--max-text-length", required=True, type=int)
    command.add_argument("--allow-real-data", action="store_true")
    command = commands.add_parser("train", help="Run the pinned official PaddleOCR trainer")
    for name in ("data", "upstream", "weights", "output"):
        command.add_argument("--" + name, required=True, type=Path)
    command.add_argument("--expected-weights-sha256", required=True)
    command.add_argument("--epochs", required=True, type=int)
    command.add_argument("--batch-size", required=True, type=int)
    command.add_argument("--learning-rate", required=True, type=float)
    command.add_argument("--seed", required=True, type=int)
    command.add_argument("--device", required=True, choices=("cpu", "cuda"))
    command.add_argument("--allow-expanded-head", action="store_true")
    command = commands.add_parser("export", help="Export a candidate without approving deployment")
    for name in ("run", "upstream", "output"):
        command.add_argument("--" + name, required=True, type=Path)
    command.add_argument("--opset", type=int, default=17)
    command = commands.add_parser("evaluate", help="Held-out exact-Unicode metrics and numerical conversion parity")
    for name in ("data", "candidate", "baseline-model", "baseline-dictionary", "policy-path", "output"):
        command.add_argument("--" + name, required=True, type=Path)
    args = vars(parser.parse_args())
    action = args.pop("command")
    if action == "train":
        args["use_gpu"] = args.pop("device") == "cuda"
    try:
        result = {"prepare": prepare, "train": train, "export": export, "evaluate": evaluate}[action](**args)
        # The report contains aggregate metrics only, never per-sample predictions.
        print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
        return 2 if action == "evaluate" and not result["cpu_gate_pass"] else 0
    except PipelineError as error:
        print(str(error), file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Interrupted; no deployment was performed.", file=sys.stderr)
        return 130
    except (OSError, UnicodeError, ValueError, KeyError, TypeError) as error:
        print(f"Input or environment failure ({type(error).__name__}); raw details were not forwarded.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
