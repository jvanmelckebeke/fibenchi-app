"""Fill the tester and grader prompt templates for a prepared run.

    python3 scripts/ux-loop/render_prompts.py <run-dir> <label> [<label> ...]

The first label gets three bare and three explained testers; every further
label gets three bare testers, so builds are compared on the bare variant.
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TESTERS_PER_CELL = 3


def main() -> None:
    run, labels = Path(sys.argv[1]), sys.argv[2:]
    tester = (HERE / "prompts" / "tester.md").read_text()
    cells = [(labels[0], "bare"), (labels[0], "explained")] + [(label, "bare") for label in labels[1:]]

    names = []
    for label, variant in cells:
        captured = json.loads((run / f"{label}-text" / "manifest.json").read_text())["captured_at"][:16]
        for i in range(1, TESTERS_PER_CELL + 1):
            name = f"{label}-{variant}-{i}"
            names.append(name)
            (run / "prompts" / f"{name}.md").write_text(tester.format(
                screens_dir=run / label,
                captured_at=captured,
                glossary=run / f"glossary-{variant}.md",
                notes=run / "answers" / f"{name}.notes.txt",
                answer=run / "answers" / f"{name}.md",
            ))

    grader = (HERE / "prompts" / "grader.md").read_text().format(
        answers=", ".join(str(run / "answers" / f"{n}.md") for n in names),
        truths=", ".join(str(run / f"truth-{label}.json") for label in labels),
        texts=", ".join(str(run / f"{label}-text") for label in labels),
        glossaries=f"{run / 'glossary-bare.md'}, {run / 'glossary-explained.md'}",
        screens=", ".join(str(run / label) for label in labels),
        report=run / "report.md",
    )
    (run / "prompts" / "grader.md").write_text(grader)
    print("\n".join(str(run / "prompts" / f"{n}.md") for n in names + ["grader"]))


if __name__ == "__main__":
    main()
