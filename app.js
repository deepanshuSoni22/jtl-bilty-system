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
var chargeCount  = 0;
var igstOn       = false;
var MAX_CHARGES  = 8;
var pollInterval = null;
var pollCount    = 0;
var MAX_POLLS    = 60;  // 60 × 3s = 3 minutes max

// ══════════════════════════════════════════════════════════════
//  ON LOAD
// ══════════════════════════════════════════════════════════════
window.onload = function () {
  var today = new Date().toISOString().split("T")[0];
  document.getElementById("billDate").value  = today;
  document.getElementById("cnoteDate").value = today;
  addCharge(true);  // First row required

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
//  CHARGE ROWS
// ══════════════════════════════════════════════════════════════
function addCharge(required) {
  if (chargeCount >= MAX_CHARGES) return;
  chargeCount++;

  var wrapper = document.createElement("div");
  wrapper.className = "charge-row";
  wrapper.id = "chargeRow" + chargeCount;

  var inner = document.createElement("div");
  inner.className = "charge-row-inner";

  // Row number
  var num = document.createElement("span");
  num.className   = "charge-num";
  num.textContent = chargeCount + ".";

  // Label input (free text)
  var labelInp = document.createElement("input");
  labelInp.type        = "text";
  labelInp.className   = "form-control";
  labelInp.placeholder = "e.g. FREIGHT, TOLL, LOADING";
  labelInp.id          = "chargeLabel" + chargeCount;
  if (required) labelInp.required = true;
  labelInp.addEventListener("input", function() {
    labelInp.value = labelInp.value.toUpperCase();
  });

  // Amount input
  var amtInp = document.createElement("input");
  amtInp.type        = "number";
  amtInp.min         = "0";
  amtInp.step        = "0.01";
  amtInp.className   = "form-control mono";
  amtInp.placeholder = "0.00";
  amtInp.id          = "chargeAmt" + chargeCount;
  amtInp.inputMode   = "decimal";
  if (required) amtInp.required = true;
  amtInp.addEventListener("input", updateTotal);

  // Remove button (not on first row)
  var rm = document.createElement("div"); // placeholder to keep grid
  rm.style.width = "34px";

  if (chargeCount > 1) {
    rm = document.createElement("button");
    rm.type      = "button";
    rm.className = "btn-remove-charge";
    rm.innerHTML = "&times;";
    rm.title     = "Remove this charge";
    (function(rowId) {
      rm.onclick = function() { removeCharge(rowId); };
    })(wrapper.id);
  }

  inner.appendChild(num);
  inner.appendChild(labelInp);
  inner.appendChild(amtInp);
  inner.appendChild(rm);
  wrapper.appendChild(inner);

  document.getElementById("chargeRows").appendChild(wrapper);
  if (!required) labelInp.focus();
  updateAddBtn();
  updateTotal();
}

function removeCharge(rowId) {
  var row = document.getElementById(rowId);
  if (row) row.remove();
  chargeCount--;
  // Renumber
  document.querySelectorAll(".charge-num").forEach(function(el, i) {
    el.textContent = (i + 1) + ".";
  });
  updateAddBtn();
  updateTotal();
}

function updateAddBtn() {
  var btn = document.getElementById("btnAddCharge");
  btn.disabled    = chargeCount >= MAX_CHARGES;
  btn.textContent = chargeCount >= MAX_CHARGES
    ? "Maximum 8 charges reached"
    : "+ Add Another Charge";
}

// ══════════════════════════════════════════════════════════════
//  RUNNING TOTAL
// ══════════════════════════════════════════════════════════════
function updateTotal() {
  var total = 0;
  for (var i = 1; i <= MAX_CHARGES; i++) {
    var el = document.getElementById("chargeAmt" + i);
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
  var charges = [];
  for (var i = 1; i <= MAX_CHARGES; i++) {
    var lbl = document.getElementById("chargeLabel" + i);
    var amt = document.getElementById("chargeAmt"   + i);
    if (!lbl && !amt) continue;
    var labelVal = lbl ? lbl.value.trim().toUpperCase() : "";
    var amtVal   = amt ? (amt.value || "")              : "";
    // Only include rows where at least one field is filled
    if (labelVal !== "" || amtVal !== "") {
      charges.push({ label: labelVal, amount: amtVal });
    }
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
    charges:      charges,
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
  var hasCharge = data.charges.some(function(c) {
    return c.label !== "" || (c.amount !== "" && parseFloat(c.amount) > 0);
  });
  if (!hasCharge) return "At least one Charge is required.";
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

    showProcessing();
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
        "Taking longer than expected. Check the Bills Log sheet in a few minutes for your PDF link."
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
        showError("Background job failed: " + (res.error || "Check Apps Script logs."));
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
    el.className = i < n ? "step done" : i === n ? "step active" : "step wait";
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

function showProcessing() {
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
