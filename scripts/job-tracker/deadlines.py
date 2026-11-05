"""DEADLINE-RELEVANCE-001 (owner 2026-11-01): a posting whose application deadline is today or earlier is not
relevant ("the due date passed today ... pay attention to due date relevance in the future"; Skatteforvaltningen,
deadline "senest den 1. november 2026", was still proposed and open on 1 November).

find_deadline(text) returns the application deadline stated in a posting's text, or None. A date only counts when an
application-deadline cue sits right before it (frist, ansøgningsfrist, senest, sidste ansøgningsdag, deadline, apply
by / before, no later than, closing date ...), so a start date ("tiltrædelse 1. januar 2027") is never read as one.
Formats: 1. november 2026 / 1 november 2026 / November 1, 2026 / 1st November 2026 / 01.11.2026 / 1/11-2026 /
2026-11-01. A date without a year takes the posting's year (`today`'s), moved to next year when that would put it
more than 120 days in the past (a December ad that says "senest 10. januar").

is_past(deadline, today) is True when the deadline is today or earlier: applying on the last day is not worth a
proposal, and the owner reads a same-day deadline as passed.
"""
import datetime
import re

MONTHS = {
    "januar": 1, "january": 1, "jan": 1, "februar": 2, "february": 2, "feb": 2, "marts": 3, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "maj": 5, "may": 5, "juni": 6, "june": 6, "jun": 6, "juli": 7, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9, "oktober": 10, "october": 10, "okt": 10, "oct": 10,
    "november": 11, "nov": 11, "december": 12, "dec": 12,
}
_MON = "|".join(sorted(MONTHS, key=len, reverse=True))
CUE = (r"(?:ansøgningsfrist(?:en)?|ansoegningsfrist|frist(?:en)?|sidste\s+ansøgningsdag|senest|søg\s+inden|"
       r"ansøg\s+(?:senest|inden)|application\s+deadline|deadline(?:\s+for\s+applications?)?|closing\s+date|"
       r"apply\s+(?:by|before|no\s+later\s+than)|no\s+later\s+than|applications?\s+(?:close|must\s+be\s+received)\s*(?:on|by)?)")
# up to ~40 characters of filler between the cue and the date ("senest den", "is", ":", "søndag d.")
GAP = r"[^.\n]{0,40}?"
DATE = (r"(?P<d1>\d{1,2})\.?\s*(?P<m1>" + _MON + r")\.?,?\s*(?P<y1>\d{4})?"          # 1. november 2026
        r"|(?P<m2>" + _MON + r")\.?\s+(?P<d2>\d{1,2})(?:st|nd|rd|th)?,?\s*(?P<y2>\d{4})?"  # November 1, 2026
        r"|(?P<d3>\d{1,2})(?:st|nd|rd|th)\s+(?P<m3>" + _MON + r"),?\s*(?P<y3>\d{4})?"     # 1st November 2026
        r"|(?P<y4>\d{4})-(?P<m4>\d{1,2})-(?P<d4>\d{1,2})"                                 # 2026-11-01
        r"|(?P<d5>\d{1,2})[./-](?P<m5>\d{1,2})[./-](?P<y5>\d{2,4})")                      # 01.11.2026, 1/11-2026
RX = re.compile(CUE + GAP + r"(?:" + DATE + r")", re.I)


def _mk(y, m, d, today):
    try:
        if y is None:
            dt = datetime.date(today.year, m, d)
            if (today - dt).days > 120:
                dt = datetime.date(today.year + 1, m, d)
            return dt
        y = int(y)
        if y < 100:
            y += 2000
        return datetime.date(y, m, d)
    except ValueError:
        return None


def find_deadline(text, today=None):
    """The first application deadline stated in `text`, or None."""
    today = today or datetime.date.today()
    for m in RX.finditer(text or ""):
        g = m.groupdict()
        if g["d1"]:
            dt = _mk(g["y1"], MONTHS[g["m1"].lower()], int(g["d1"]), today)
        elif g["m2"]:
            dt = _mk(g["y2"], MONTHS[g["m2"].lower()], int(g["d2"]), today)
        elif g["d3"]:
            dt = _mk(g["y3"], MONTHS[g["m3"].lower()], int(g["d3"]), today)
        elif g["y4"]:
            dt = _mk(g["y4"], int(g["m4"]), int(g["d4"]), today)
        else:
            dt = _mk(g["y5"], int(g["m5"]), int(g["d5"]), today)
        if dt:
            return dt
    return None


def is_past(deadline, today=None):
    today = today or datetime.date.today()
    return deadline is not None and deadline <= today
