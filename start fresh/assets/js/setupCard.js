// ---------------------------
// Bottle count (Setup feature)
// ---------------------------
const MIN_BOTTLES = 4;
const MAX_BOTTLES = 14;

export function initSetupCard(options = {}) {
    const {onNext} = options;
    const numBottlesEl = document.getElementById("numBottles");
    const NextBtnEl = document.getElementById("setupNextBtn");
    const MsgEl = document.getElementById("setupMsg");

    // If the HTML isn’t present, we stop safely.
    if (!numBottlesEl || !NextBtnEl || !MsgEl) {
        console.warn("SetupCard: missing HTML elements");
        return {};
    }

    // Set bottle count programmatically (also updates UI).
    function setBottleCount(n) {
        numBottlesEl.value = String(n);
        updateUI();
    }

    // Reset to initial state.
    function reset() {
    numBottlesEl.value = "14";
    updateUI();               
    MsgEl.textContent = "";   
    }


    // Read and validate bottle count.
    function readBottleCount() {
        const n = Number(numBottlesEl.value);

        if (!Number.isFinite(n)) return null;
        if (!Number.isInteger(n)) return null;
        if (n < MIN_BOTTLES || n > MAX_BOTTLES) return null;

        return n;
    }

    // Enable/disable button + show message.
    function updateUI() {
        const n = readBottleCount();

        if (n === null) {
        NextBtnEl.disabled = true;
        MsgEl.textContent =
            `Please enter a whole number from ${MIN_BOTTLES} to ${MAX_BOTTLES}.`;
        return;
        }

        NextBtnEl.disabled = false;
        MsgEl.textContent = `OK: ${n} bottles selected.`;
    }

    numBottlesEl.addEventListener("input", updateUI);

    // When user clicks Build, call onBuild(n) if provided.
    NextBtnEl.addEventListener("click", () => {
        const n = readBottleCount();
        if (n === null) return;

        if (typeof onNext === "function") {
        onNext(n);
        }
    });

    // Run once at startup to match default value.
    updateUI();

    // Expose a small API to the rest of the app.
    return {
        getBottleCount: readBottleCount,
        setBottleCount,
        reset,
    };
}

