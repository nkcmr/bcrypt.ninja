package main

import (
	"fmt"
	"syscall/js"

	"golang.org/x/crypto/bcrypt"
)

func promise(fn func(func(js.Value), func(js.Value))) js.Value {
	var handler js.Func
	handler = js.FuncOf(func(_ js.Value, args []js.Value) interface{} {
		resolve, reject := args[0], args[1]
		fn(
			func(v js.Value) {
				resolve.Invoke(v)
				handler.Release()
			},
			func(err js.Value) {
				reject.Invoke(err)
				handler.Release()
			},
		)
		return nil
	})
	return js.Global().Get("Promise").New(handler)
}

func jsError(err error) js.Value {
	return js.Global().Get("Error").New(err.Error())
}

func main() {
	fmt.Println("go initializaing...")
	js.Global().Set("bcrypt_hash", js.FuncOf(func(_ js.Value, args []js.Value) interface{} {
		return promise(
			func(resolve, reject func(js.Value)) {
				go func() {
					fmt.Printf("bcrypt_hash\n")
					if len(args) != 2 {
						reject(jsError(fmt.Errorf("expected 2 arguments, got %d", len(args))))
						return
					} else if t := args[0].Type(); t != js.TypeNumber {
						reject(jsError(fmt.Errorf("expected argument 1 to be a number, got %s", t.String())))
						return
					} else if t := args[1].Type(); t != js.TypeString {
						reject(jsError(fmt.Errorf("expected argument 2 to be a string, got %s", t.String())))
						return
					}
					cost, password := args[0].Int(), args[1].String()
					hash, err := bcrypt.GenerateFromPassword([]byte(password), cost)
					if err != nil {
						reject(jsError(fmt.Errorf("failed to generate hash from password: %s", err.Error())))
						return
					}
					resolve(js.ValueOf(string(hash)))
				}()
			},
		)
	}))
	js.Global().Set("bcrypt_verify", js.FuncOf(func(_ js.Value, args []js.Value) interface{} {
		return promise(
			func(resolve, reject func(js.Value)) {
				go func() {
					fmt.Printf("bcrypt_verify\n")
					if len(args) != 2 {
						reject(jsError(fmt.Errorf("expected 2 arguments, got %d", len(args))))
						return
					} else if t := args[0].Type(); t != js.TypeString {
						reject(jsError(fmt.Errorf("expected argument 1 to be a string, got %s", t.String())))
						return
					} else if t := args[1].Type(); t != js.TypeString {
						reject(jsError(fmt.Errorf("expected argument 2 to be a string, got %s", t.String())))
						return
					}
					hash, password := args[0].String(), args[1].String()
					err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
					if err != nil {
						if err == bcrypt.ErrMismatchedHashAndPassword {
							resolve(js.ValueOf(false))
						} else {
							reject(jsError(fmt.Errorf("failed to check password: %s", err.Error())))
						}
						return
					}
					resolve(js.ValueOf(true))
				}()
			},
		)
	}))
	var neverEnding chan struct{}
	<-neverEnding
}
