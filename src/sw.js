if (!WebAssembly.instantiateStreaming) {
  // polyfill
  WebAssembly.instantiateStreaming = function (respPromise, importObject) {
    return new Promise(function (resolve, reject) {
      Promise.resolve(respPromise)
        .then(function (resp) {
          return resp.arrayBuffer();
        })
        .then(function (source) {
          return WebAssembly.instantiate(source, importObject);
        })
        .then(function (wasmExports) {
          resolve(wasmExports);
        })
        .catch(reject);
    });
  };
}

let wasmResolve, wasmReject;
let wasmReady = new Promise(function (resolve, reject) {
  wasmResolve = resolve;
  wasmReject = reject;
});
// failures are reported per-request; this just prevents an unhandled rejection
wasmReady.catch(function () {});

const go = new Go();
console.log("loading wasm...");
WebAssembly.instantiateStreaming(fetch("/bcrypt.wasm"), go.importObject)
  .then(function (result) {
    console.log("wasm loaded! starting go runtime...");
    go.run(result.instance);
    const cancelWait = setInterval(() => {
      console.log("exports from go appear to be set, all ready!");
      if (globalThis.bcrypt_hash) {
        clearInterval(cancelWait);
        wasmResolve();
      }
    }, 50);
  })
  .catch(function (err) {
    wasmReject(new Error(`failed to load bcrypt.wasm: ${errorMessage(err)}`));
  });

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

self.addEventListener("message", function (event) {
  console.log(
    `op = ${event.data.op}, args = ${JSON.stringify(event.data.args)}`
  );
  switch (event.data.op) {
    case "bcrypt_hash":
      wasmReady
        .then(function () {
          return bcrypt_hash(event.data.args[0], event.data.args[1]);
        })
        .then(function (hash) {
          self.postMessage({ result: hash });
        })
        .catch((err) => {
          self.postMessage({ error: errorMessage(err) });
        });
      break;
    case "bcrypt_verify":
      wasmReady
        .then(function () {
          return bcrypt_verify(event.data.args[0], event.data.args[1]);
        })
        .then(function (ok) {
          self.postMessage({ result: ok });
        })
        .catch((err) => {
          self.postMessage({ error: errorMessage(err) });
        });
      break;
    default:
  }
});
