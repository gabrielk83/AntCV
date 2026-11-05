"""DEADLINE-RELEVANCE-001 tests: deadline parsing from posting text (owner 2026-11-01)."""
import datetime
import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("deadlines", HERE / "deadlines.py")
dl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dl)

TODAY = datetime.date(2026, 11, 1)
fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s: got %r want %r" % (name, got, want))


D = lambda s: dl.find_deadline(s, TODAY)
check("Skatteforvaltningen wording (the owner's case)",
      D("Send en motiveret ansøgning, CV, eksamenspapirer og andre relevante dokumenter via linket "
        "”Søg stillingen” senest den 1. november 2026."), datetime.date(2026, 11, 1))
check("ansøgningsfrist with numeric date", D("Ansøgningsfrist: 14.11.2026"), datetime.date(2026, 11, 14))
check("frist with dash-year", D("Frist 3/12-2026"), datetime.date(2026, 12, 3))
check("English deadline, month first", D("Application deadline: November 20, 2026"), datetime.date(2026, 11, 20))
check("apply by, ordinal day", D("Please apply by 5th December 2026."), datetime.date(2026, 12, 5))
check("ISO date", D("Deadline 2026-11-15"), datetime.date(2026, 11, 15))
check("no year takes the posting year", D("Søg senest 30. november"), datetime.date(2026, 11, 30))
check("no year far in the past rolls to next year", D("senest den 10. januar"), datetime.date(2027, 1, 10))
check("a start date is not a deadline", D("Tiltrædelse 1. januar 2027 eller snarest muligt."), None)
check("a posted date is not a deadline", D("Posted 2026-10-13. Interviews begin as soon as possible."), None)
check("no deadline at all", D("Applications will be processed as they are received."), None)
check("deadline today counts as passed", dl.is_past(datetime.date(2026, 11, 1), TODAY), True)
check("deadline tomorrow is still open", dl.is_past(datetime.date(2026, 11, 2), TODAY), False)
check("no deadline is never past", dl.is_past(None, TODAY), False)

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - deadline parsing (%d checks)" %
      sum(1 for ln in open(__file__, encoding="utf-8") if ln.lstrip().startswith("check(")))
