// The per-address request limiter's decision rule, proved, compiled to JS for
// src/lib/server/request-limit.ts. Pure: the TS wrapper runs the one D1 upsert per
// window and passes the returned hit count in. Time is unix seconds.
//
// Model: a limit is (max, windowSeconds). Each hit lands in the fixed window that
// contains `now`; the D1 row for (scope, who, windowStart) counts the hits, and the
// upsert returns the count INCLUDING this hit. A hit is allowed while that count is
// at most max.

module RequestLimitCore {

  // ---- The functions the TS calls ----

  // The start of the fixed window that `now` falls in.
  function WindowStart(now: int, windowSeconds: int): int
    requires windowSeconds > 0
  {
    now - (now % windowSeconds)
  }

  // Whether a window that has now been hit `hits` times (this hit included) allows it.
  function WithinLimit(hits: int, max: int): bool { hits <= max }

  // Seconds until the window that refused the hit ends. 0 when allowed.
  function RetryAfter(hits: int, max: int, now: int, windowSeconds: int): int
    requires windowSeconds > 0
  {
    if WithinLimit(hits, max) then 0 else WindowStart(now, windowSeconds) + windowSeconds - now
  }

  // Combining several limits: the longest wait wins; allowed only if every limit allows.
  function CombineRetry(a: int, b: int): int { if a >= b then a else b }

  // ---- Properties ----

  // `now` lies in [start, start + w): the window really contains the hit.
  lemma WindowContainsNow(now: int, w: int)
    requires w > 0
    ensures WindowStart(now, w) <= now < WindowStart(now, w) + w
  {}

  // Window starts are aligned, so every hit in one window maps to the same row.
  lemma WindowAligned(now: int, w: int)
    requires w > 0
    ensures WindowStart(now, w) % w == 0
  {
    var k := now / w;
    assert now == k * w + now % w;
    assert WindowStart(now, w) == k * w + 0;
    ModUnique(WindowStart(now, w), w, k, 0);
  }

  // Euclidean remainder is unique: b == q*w + r with 0 <= r < w fixes r.
  lemma ModUnique(b: int, w: int, q: int, r: int)
    requires w > 0 && 0 <= r < w && b == q * w + r
    ensures b % w == r
  {
    var q2, r2 := b / w, b % w;
    assert b == q2 * w + r2;
    assert (q - q2) * w == r2 - r;
    if q > q2 {
      MulAtLeast(q - q2, w);
    } else if q < q2 {
      assert (q2 - q) * w == r - r2;
      MulAtLeast(q2 - q, w);
    }
  }

  lemma MulNonneg(e: int, w: int)
    requires e >= 0 && w >= 0
    ensures e * w >= 0
    decreases e
  {
    if e > 0 {
      MulNonneg(e - 1, w);
      assert e * w == (e - 1) * w + w;
    }
  }

  lemma MulAtLeast(d: int, w: int)
    requires d >= 1 && w > 0
    ensures d * w >= w
  {
    MulNonneg(d - 1, w);
    assert d * w == (d - 1) * w + w;
  }

  lemma SameWindowSameRow(a: int, b: int, w: int)
    requires w > 0
    requires WindowStart(a, w) <= b < WindowStart(a, w) + w
    ensures WindowStart(b, w) == WindowStart(a, w)
  {
    var s := WindowStart(a, w);
    var k := a / w;
    assert a == k * w + a % w;
    assert s == k * w;
    ModUnique(b, w, k, b - s);
  }

  // A refused hit always waits a positive time, never longer than one window.
  lemma RetryBounded(hits: int, max: int, now: int, w: int)
    requires w > 0
    ensures !WithinLimit(hits, max) ==> 0 < RetryAfter(hits, max, now, w) <= w
    ensures WithinLimit(hits, max) <==> RetryAfter(hits, max, now, w) == 0
  {}

  // Hits counted 1, 2, 3 ... in one window: exactly `max` of them are allowed.
  function AllowedOf(n: nat, max: int): nat
  {
    if n == 0 then 0 else AllowedOf(n - 1, max) + (if WithinLimit(n, max) then 1 else 0)
  }

  lemma AtMostMaxPerWindow(n: nat, max: nat)
    ensures AllowedOf(n, max) == if n <= max then n else max
  {
    if n > 0 { AtMostMaxPerWindow(n - 1, max); }
  }

  lemma CombineIsMax(a: int, b: int)
    ensures CombineRetry(a, b) >= a && CombineRetry(a, b) >= b
    ensures CombineRetry(a, b) == a || CombineRetry(a, b) == b
  {}
}
