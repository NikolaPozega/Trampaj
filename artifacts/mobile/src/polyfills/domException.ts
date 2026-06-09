if (typeof globalThis.DOMException === "undefined") {
  class DOMExceptionPolyfill extends Error {
    constructor(message = "", name = "Error") {
      super(message);
      this.name = name;
    }
  }

  Object.defineProperty(globalThis, "DOMException", {
    value: DOMExceptionPolyfill,
    writable: true,
    configurable: true,
  });
}
