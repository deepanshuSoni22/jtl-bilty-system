// ══════════════════════════════════════════════════════════════
//  CONFIG — stored in localStorage, entered once per device
// ══════════════════════════════════════════════════════════════
var SCRIPT_URL = localStorage.getItem("JTL_SCRIPT_URL") || "";

function saveScriptUrl() {
  var val = document.getElementById("urlInput").value.trim();
  if (!val || val.indexOf("script.google.com") === -1) {
    alert("Please paste a valid Apps Script URL.");
    return;
  }
  localStorage.setItem("JTL_SCRIPT_URL", val);
  SCRIPT_URL = val;
  document.getElementById("setupBanner").style.display = "none";
  loadBillNo();
}

// ══════════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════════
var amountCount  = 0;
var igstOn       = false;
var MAX_AMOUNTS  = 8;
var pollInterval = null;
var pollCount    = 0;
var MAX_POLLS    = 60;   // 60 × 3s = 3 minutes max wait

// ══════════════════════════════════════════════════════════════
//  ON LOAD
// ══════════════════════════════════════════════════════════════
window.onload = function () {
  var today = new Date().toISOString().split("T")[0];
  document.getElementById("billDate").value  = today;
  document.getElementById("cnoteDate").value = today;
  addAmount(true);

  if (!SCRIPT_URL) {
    document.getElementById("setupBanner").style.display = "block";
  } else {
    loadBillNo();
  }
};

function loadBillNo() {
  if (!SCRIPT_URL) return;
  fetch(SCRIPT_URL + "?action=getNextBillNo", { redirect: "follow" })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      document.getElementById("billNo").value              = d.billNo || "—";
      document.getElementById("billNoDisplay").textContent = d.billNo || "—";
    })
    .catch(function() {
      document.getElementById("billNo").value = "Check URL";
    });
}

// ══════════════════════════════════════════════════════════════
//  AMOUNT ROWS
// ══════════════════════════════════════════════════════════════
function addAmount(required) {
  if (amountCount >= MAX_AMOUNTS) return;
  amountCount++;

  var row = document.createElement("div");
  row.className = "amount-row d-flex align-items-center gap-2 mb-2";
  row.id = "amtRow" + amountCount;

  var lbl = document.createElement("span");
  lbl.className   = "amount-num";
  lbl.textContent = amountCount + ".";

  var inp = document.createElement("input");
  inp.type      = "number";
  inp.min       = "0";
  inp.step      = "0.01";
  inp.className = "form-control mono";
  inp.placeholder = "Enter amount";
  inp.id        = "amt" + amountCount;
  inp.inputMode = "decimal";
  if (required) inp.required = true;
  inp.addEventListener("input", updateTotal);

  row.appendChild(lbl);
  row.appendChild(inp);

  if (amountCount > 1) {
    var rm = document.createElement("button");
    rm.type      = "button";
    rm.className = "btn-remove-amt";
    rm.innerHTML = "&times;";
    rm.title     = "Remove";
    (function(rId) { rm.onclick = function() { removeAmount(rId); }; })(row.id);
    row.appendChild(rm);
  }

  document.getElementById("amountRows").appendChild(row);
  if (!required) inp.focus();
  updateAddBtn();
  updateTotal();
}

function removeAmount(rowId) {
  var row = document.getElementById(rowId);
  if (row) row.remove();
  amountCount--;
  document.querySelectorAll(".amount-num").forEach(function(el, i) {
    el.textContent = (i + 1) + ".";
  });
  updateAddBtn();
  updateTotal();
}

function updateAddBtn() {
  var btn = document.getElementById("btnAddAmount");
  btn.disabled    = amountCount >= MAX_AMOUNTS;
  btn.textContent = amountCount >= MAX_AMOUNTS
    ? "Maximum 8 amounts reached"
    : "+ Add Another Amount";
}

// ══════════════════════════════════════════════════════════════
//  RUNNING TOTAL
// ══════════════════════════════════════════════════════════════
function updateTotal() {
  var total = 0;
  for (var i = 1; i <= MAX_AMOUNTS; i++) {
    var el = document.getElementById("amt" + i);
    if (el && el.value) total += parseFloat(el.value) || 0;
  }
  document.getElementById("runningTotal").textContent =
    "₹ " + total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (igstOn) {
    var igst = Math.round(total * 0.18 * 100) / 100;
    document.getElementById("igstResult").textContent =
      "= ₹ " + igst.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  }
}

// ══════════════════════════════════════════════════════════════
//  IGST TOGGLE
// ══════════════════════════════════════════════════════════════
function toggleIgst() {
  igstOn = !igstOn;
  document.getElementById("igstTrack").classList.toggle("on", igstOn);
  if (!igstOn) document.getElementById("igstResult").textContent = "";
  updateTotal();
}

// ══════════════════════════════════════════════════════════════
//  COLLECT & VALIDATE
// ══════════════════════════════════════════════════════════════
function collectData() {
  var amounts = [];
  for (var i = 1; i <= MAX_AMOUNTS; i++) {
    var el = document.getElementById("amt" + i);
    amounts.push(el ? (el.value || "") : "");
  }
  return {
    billDate:     document.getElementById("billDate").value,
    billTo:       document.getElementById("billTo").value.trim(),
    billToGstin:  document.getElementById("billToGstin").value.trim().toUpperCase(),
    shipTo:       document.getElementById("shipTo").value.trim(),
    shipToGstin:  document.getElementById("shipToGstin").value.trim().toUpperCase(),
    cnoteNo:      document.getElementById("cnoteNo").value.trim(),
    cnoteDate:    document.getElementById("cnoteDate").value,
    from:         document.getElementById("from").value.trim(),
    to:           document.getElementById("to").value.trim(),
    packages:     document.getElementById("packages").value.trim(),
    vehicleNo:    document.getElementById("vehicleNo").value.trim().toUpperCase(),
    vehicleType:  document.getElementById("vehicleType").value.trim(),
    amounts:      amounts,
    cgstPct:      document.getElementById("cgstPct").value.trim() || "-",
    sgstPct:      document.getElementById("sgstPct").value.trim() || "-",
    igst:         igstOn ? "YES" : "NO",
    gstPayableBy: document.getElementById("gstPayableBy").value.trim(),
  };
}

function validate(data) {
  if (!data.billDate)  return "Bill Date is required.";
  if (!data.billTo)    return "Bill To is required.";
  if (!data.cnoteNo)   return "C/Note No is required.";
  if (!data.cnoteDate) return "C/Note Date is required.";
  if (!data.from)      return "From location is required.";
  if (!data.to)        return "To location is required.";
  if (!data.vehicleNo) return "Vehicle No is required.";
  var hasAmt = data.amounts.some(function(a) { return a !== "" && parseFloat(a) > 0; });
  if (!hasAmt) return "At least one Amount is required.";
  return null;
}

// ══════════════════════════════════════════════════════════════
//  SUBMIT — sends data, gets jobId back instantly, then polls
// ══════════════════════════════════════════════════════════════
function submitForm() {
  hideError();
  hideResult();
  hideProcessing();

  if (!SCRIPT_URL) {
    document.getElementById("setupBanner").style.display = "block";
    document.getElementById("setupBanner").scrollIntoView({ behavior: "smooth" });
    return;
  }

  var data = collectData();
  var err  = validate(data);
  if (err) { showError(err); return; }

  setLoading(true);

  fetch(SCRIPT_URL, {
    method:   "POST",
    redirect: "follow",
    body:     JSON.stringify(data),
  })
  .then(function(r) {
    if (!r.ok) throw new Error("Server returned HTTP " + r.status);
    return r.json();
  })
  .then(function(result) {
    setLoading(false);

    if (!result.success) {
      showError("Error: " + (result.error || "Unknown error"));
      return;
    }

    // Job queued — show processing UI and start polling
    showProcessing(result.billNo);
    startPolling(result.jobId, result.billNo);
  })
  .catch(function(e) {
    setLoading(false);
    showError("Network error: " + e.message +
      " — Ensure Apps Script is deployed as 'Anyone can access'.");
  });
}

// ══════════════════════════════════════════════════════════════
//  POLLING — checks job status every 3 seconds
// ══════════════════════════════════════════════════════════════
function startPolling(jobId, billNo) {
  pollCount = 0;
  var stepIndex = 1; // tracks fake progress steps

  pollInterval = setInterval(function() {
    pollCount++;

    // Animate steps while waiting (purely cosmetic)
    if (pollCount === 3)  activateStep(3);
    if (pollCount === 6)  activateStep(4);
    if (pollCount === 9)  activateStep(5);

    // Timeout guard
    if (pollCount >= MAX_POLLS) {
      clearInterval(pollInterval);
      hideProcessing();
      showError(
        "It's taking longer than expected. Your bill is still being generated in the background. " +
        "Check the Bills Log sheet in Google Sheets in a few minutes for the PDF link."
      );
      return;
    }

    fetch(SCRIPT_URL + "?action=pollJob&jobId=" + encodeURIComponent(jobId), {
      redirect: "follow",
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.status === "done") {
        clearInterval(pollInterval);
        hideProcessing();
        showResult(res.billNo || billNo, res.pdfUrl);
      } else if (res.status === "error") {
        clearInterval(pollInterval);
        hideProcessing();
        showError("Background job failed: " + (res.error || "Unknown error. Check Apps Script logs."));
      }
      // status === "pending" or "running" → keep polling
    })
    .catch(function() {
      // Network blip — keep polling, don't stop
    });

  }, 3000); // poll every 3 seconds
}

function activateStep(n) {
  for (var i = 1; i <= 5; i++) {
    var el = document.getElementById("step" + i);
    if (!el) continue;
    if (i < n)  { el.className = "step done"; }
    else if (i === n) { el.className = "step active"; }
    else        { el.className = "step wait"; }
  }
}

// ══════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════
function setLoading(on) {
  document.getElementById("btnSubmit").disabled    = on;
  document.getElementById("spinner").style.display = on ? "block" : "none";
  document.getElementById("btnLabel").textContent  = on ? "Submitting…" : "Generate Bilty PDF";
}

function showProcessing(billNo) {
  document.getElementById("processingCard").classList.add("show");
  document.getElementById("processingCard").scrollIntoView({ behavior: "smooth" });
  activateStep(2);
}
function hideProcessing() {
  document.getElementById("processingCard").classList.remove("show");
}

function showError(msg) {
  var el = document.getElementById("errorBar");
  el.textContent = "⚠ " + msg;
  el.classList.remove("d-none");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function hideError() { document.getElementById("errorBar").classList.add("d-none"); }

function showResult(billNo, url) {
  document.getElementById("resultMeta").textContent =
    "Bill #" + billNo + " — saved to Drive › " + getMonthYear();
  document.getElementById("pdfLink").href = url;
  document.getElementById("resultCard").classList.add("show");
  document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" });
}
function hideResult() { document.getElementById("resultCard").classList.remove("show"); }

function resetForm() { window.location.reload(); }

function getMonthYear() {
  var d = new Date();
  var m = ["January","February","March","April","May","June",
           "July","August","September","October","November","December"];
  return m[d.getMonth()] + " " + d.getFullYear();
}
