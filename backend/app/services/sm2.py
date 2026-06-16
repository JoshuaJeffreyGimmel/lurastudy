"""
SM-2 Spaced Repetition Algorithm
---------------------------------
Based on the original SuperMemo SM-2 algorithm by Piotr Wozniak.

Quality ratings (0–5):
  5 — perfect response
  4 — correct response after a hesitation
  3 — correct response recalled with serious difficulty
  2 — incorrect response; where the correct one seemed easy to recall
  1 — incorrect response; the correct one remembered
  0 — complete blackout

For our two-button UI we map:
  "Easy ⚡"       → quality 5
  "Got It ✓"     → quality 4
  "Review Later ↩" → quality 1
"""

from datetime import date, timedelta


def apply_sm2(
    repetitions: int,
    ease_factor: float,
    interval: int,
    quality: int,
) -> tuple[int, float, int, date]:
    """
    Apply one SM-2 review step.

    Parameters
    ----------
    repetitions  : current consecutive-correct count
    ease_factor  : current ease factor (EF), min 1.3
    interval     : current interval in days
    quality      : user rating 0–5

    Returns
    -------
    (new_repetitions, new_ease_factor, new_interval, new_due_date)
    """
    if quality < 0 or quality > 5:
        raise ValueError(f"SM-2 quality must be 0–5, got {quality}")

    # ── Update ease factor ────────────────────────────────────────────────────
    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)  # EF never drops below 1.3

    # ── Update repetitions & interval ────────────────────────────────────────
    if quality >= 3:
        # Correct answer
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * new_ef)
        new_repetitions = repetitions + 1
    else:
        # Incorrect answer — reset to beginning
        new_repetitions = 0
        new_interval = 1

    # ── Calculate next due date ───────────────────────────────────────────────
    new_due_date = date.today() + timedelta(days=new_interval)

    return new_repetitions, new_ef, new_interval, new_due_date


def is_due(due_date: date | None) -> bool:
    """Return True if the card is due today or overdue (or has never been reviewed)."""
    if due_date is None:
        return True  # New/unseen card — always due
    return due_date <= date.today()
