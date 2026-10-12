public/bcrypt.wasm: $(wildcard bcrypt-wasm/*.go)
	GOOS=js GOARCH=wasm go build -o $@ ./bcrypt-wasm

public/sw.js: src/sw.js
	cat "$(shell go env GOROOT)/lib/wasm/wasm_exec.js" $< > $@
