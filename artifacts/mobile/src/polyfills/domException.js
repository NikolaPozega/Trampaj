if (typeof globalThis.DOMException === "undefined") {
  class DOMExceptionPolyfill extends Error {
    constructor(message, name) {
      super(message || "");
      this.name = name || "Error";
    }
  }

  Object.defineProperty(globalThis, "DOMException", {
    value: DOMExceptionPolyfill,
    writable: true,
    configurable: true,
  });
}
