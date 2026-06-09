(function () {
  var root =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof global !== "undefined"
        ? global
        : typeof window !== "undefined"
          ? window
          : this;

  if (typeof root.DOMException === "undefined") {
    var DOMExceptionPolyfill = function DOMExceptionPolyfill(message, name) {
      this.message = message || "";
      this.name = name || "Error";

      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, DOMExceptionPolyfill);
      } else {
        this.stack = new Error(this.message).stack;
      }
    };

    DOMExceptionPolyfill.prototype = Object.create(Error.prototype);
    DOMExceptionPolyfill.prototype.constructor = DOMExceptionPolyfill;

    Object.defineProperty(root, "DOMException", {
      value: DOMExceptionPolyfill,
      writable: true,
      configurable: true,
    });
  }

  if (typeof root.PerformanceEntry === "undefined") {
    var PerformanceEntryPolyfill = function PerformanceEntryPolyfill(init) {
      init = init || {};
      this.name = init.name || "";
      this.entryType = init.entryType || "";
      this.startTime = init.startTime || 0;
      this.duration = init.duration || 0;
    };

    PerformanceEntryPolyfill.prototype.toJSON = function () {
      return {
        name: this.name,
        entryType: this.entryType,
        startTime: this.startTime,
        duration: this.duration,
      };
    };

    Object.defineProperty(root, "PerformanceEntry", {
      value: PerformanceEntryPolyfill,
      writable: true,
      configurable: true,
    });
  }

  if (typeof root.performance === "undefined") {
    Object.defineProperty(root, "performance", {
      value: {
        now: function () {
          if (typeof root.nativePerformanceNow === "function") {
            return root.nativePerformanceNow();
          }
          return Date.now();
        },
        mark: function () {},
        measure: function () {},
        clearMarks: function () {},
        clearMeasures: function () {},
        getEntries: function () {
          return [];
        },
        getEntriesByType: function () {
          return [];
        },
        getEntriesByName: function () {
          return [];
        },
      },
      writable: true,
      configurable: true,
    });
  } else if (typeof root.performance.now !== "function") {
    root.performance.now = function () {
      if (typeof root.nativePerformanceNow === "function") {
        return root.nativePerformanceNow();
      }
      return Date.now();
    };
  }

  if (typeof root.PerformanceObserver === "undefined") {
    var PerformanceObserverPolyfill = function PerformanceObserverPolyfill() {};
    PerformanceObserverPolyfill.prototype.observe = function () {};
    PerformanceObserverPolyfill.prototype.disconnect = function () {};
    PerformanceObserverPolyfill.prototype.takeRecords = function () {
      return [];
    };

    Object.defineProperty(root, "PerformanceObserver", {
      value: PerformanceObserverPolyfill,
      writable: true,
      configurable: true,
    });
  }
})();
