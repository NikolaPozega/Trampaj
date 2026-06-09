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
})();
