// Token Radar dashboard: renders the board from window.BOARD (data.js),
// with search, category/status filters, sorting and a detail view per
// protocol. Reads ?q=, ?cat=, ?status=, ?sort= and ?detail=<slug> so a
// filtered or detail view can be opened directly.
(function () {
  var board = window.BOARD || { rows: [] };
  var rows = board.rows || [];
  var params = new URLSearchParams(location.search);

  function money(n) {
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + n;
  }
  function pct(v) {
    if (v === null || v === undefined) return "—";
    var s = (v > 0 ? "+" : "") + v.toFixed(1) + "%";
    return '<span class="' + (v >= 0 ? "up" : "down") + '">' + s + "</span>";
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  var qEl = document.getElementById("q");
  var catEl = document.getElementById("cat");
  var statusEl = document.getElementById("status");
  var sortEl = document.getElementById("sort");
  var rowsEl = document.getElementById("rows");
  var countEl = document.getElementById("count");

  // Category options from the data itself.
  var cats = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) === -1) cats.push(r.category);
  });
  cats.sort().forEach(function (c) {
    var o = document.createElement("option");
    o.value = c; o.textContent = c; catEl.appendChild(o);
  });

  if (params.get("q")) qEl.value = params.get("q");
  if (params.get("cat")) catEl.value = params.get("cat");
  if (params.get("status")) statusEl.value = params.get("status");
  if (params.get("sort")) sortEl.value = params.get("sort");

  document.getElementById("meta").textContent =
    "Snapshot " + (board.as_of || "") + " · " + rows.length +
    " ranked protocols · watchlist floor " + money(board.floor_usd || 0) +
    " TVL · source: DefiLlama protocols snapshot";

  function visible() {
    var q = qEl.value.trim().toLowerCase();
    var cat = catEl.value, st = statusEl.value, sort = sortEl.value;
    var list = rows.filter(function (r) {
      if (cat && r.category !== cat) return false;
      if (st && r.token_status !== st) return false;
      if (q && (r.name + " " + r.slug + " " + (r.category || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var key = { value: "implied_value_usd", tvl: "tvl_usd", growth: "change_7d", name: "name" }[sort];
    list.sort(function (a, b) {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "growth") return (b.change_7d || -999) - (a.change_7d || -999);
      return b[key] - a[key];
    });
    return list;
  }

  function render() {
    var list = visible();
    countEl.textContent = "Showing " + list.length + " of " + rows.length + " ranked protocols";
    rowsEl.innerHTML = list.map(function (r) {
      var pill = r.token_status === "pre-token"
        ? '<span class="pill pre">Pre-token</span>'
        : '<span class="pill trades">Token trades</span>';
      return "<tr data-slug=\"" + esc(r.slug) + "\">" +
        "<td class=\"rank\">" + r.rank + "</td>" +
        "<td><span class=\"name\">" + esc(r.name) + "</span><br><span class=\"sub\">" + esc(r.slug) + "</span></td>" +
        "<td>" + esc(r.category || "—") + "</td>" +
        "<td>" + esc((r.chains || []).join(", ")) + "</td>" +
        "<td class=\"num\">" + money(r.tvl_usd) + "</td>" +
        "<td class=\"num\">" + pct(r.change_7d) + "</td>" +
        "<td class=\"num\"><b>" + money(r.implied_value_usd) + "</b></td>" +
        "<td>" + pill + "</td></tr>";
    }).join("");
  }

  function showDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    document.querySelectorAll("#rows tr").forEach(function (tr) {
      tr.classList.toggle("sel", tr.getAttribute("data-slug") === slug);
    });
    var d = document.getElementById("detail");
    d.hidden = false;
    if (params.get("solo") === "detail") {
      document.getElementById("board").style.display = "none";
    }
    document.getElementById("dName").textContent = "#" + r.rank + " · " + r.name;
    document.getElementById("dSub").textContent =
      (r.category || "Uncategorised") + " · " + (r.chains || []).join(", ") +
      " · tracked since " + (r.listed_at || "unknown") +
      " · " + (r.token_status === "pre-token"
        ? "records no token — a launch candidate"
        : "its token already trades");
    var growth = r.change_7d === null ? 1 : Math.min(1.5, Math.max(0.7, 1 + r.change_7d / 100));
    document.getElementById("dFacts").innerHTML =
      "<div><b>TVL</b><span>" + money(r.tvl_usd) + "</span></div>" +
      "<div><b>7-day change</b><span>" + (r.change_7d === null ? "—" : (r.change_7d > 0 ? "+" : "") + r.change_7d.toFixed(2) + "%") + "</span></div>" +
      "<div><b>Implied value</b><span>" + money(r.implied_value_usd) + "</span></div>" +
      "<div><b>FDV/TVL multiple</b><span>" + r.multiple + "×</span></div>" +
      "<div><b>Tracked</b><span>" + r.age_months + " months</span></div>";
    document.getElementById("dModel").textContent =
      money(r.tvl_usd) + " TVL × " + r.multiple + "× (the " + (r.category || "overall") +
      " median FDV/TVL) × " + growth.toFixed(2) + " growth factor × " +
      (1 + Math.min(r.age_months, 36) * 0.005).toFixed(2) +
      " track-record factor = " + money(r.implied_value_usd) +
      ". The multiple comes from this snapshot's own token-bearing protocols, never from a name list.";
    document.getElementById("dSteps").innerHTML =
      r.farm_steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    d.scrollIntoView({ behavior: "auto", block: "start" });
  }

  rowsEl.addEventListener("click", function (e) {
    var tr = e.target.closest("tr");
    if (tr) showDetail(tr.getAttribute("data-slug"));
  });
  document.getElementById("closeDetail").addEventListener("click", function () {
    document.getElementById("detail").hidden = true;
  });
  [qEl, catEl, statusEl, sortEl].forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });

  render();
  if (params.get("detail")) showDetail(params.get("detail"));
})();
