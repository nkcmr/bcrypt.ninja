import React, { useState } from "react";
import "./App.css";
import emoji from "./emoji.svg";
import { bcryptHash, bcryptVerify } from "./worker";

const Link = (props: any) => (
  <a rel="noreferrer nofollow noopener" {...props}>
    {props.children}
  </a>
);

const Hr = () => (
  <hr className="border-solid border-gray-500 dark:border-gray-300 my-2" />
);

function noop(...discard: any): void {}

const Button = (
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean;
    busy?: boolean;
  }
) => (
  <button
    {...(() => {
      const { busy, active, ...other } = props;
      noop(busy, active);
      return other;
    })()}
    className={[
      props.className,
      (!props.className || !props.className.includes("rounded")) &&
        "rounded-md",
      props.active ? "underline" : "",
      "p-2 text-center",
      "focus:outline-hidden",
      "dark:text-gray-50",
      "text-gray-600",
      !props.busy && props.disabled ? "cursor-not-allowed" : "",
      props.busy && props.disabled ? "cursor-wait" : "",
      props.disabled
        ? "dark:bg-gray-400"
        : "dark:bg-gray-600 dark:active:bg-gray-400 dark:hover:bg-gray-500", // dark colors
      props.disabled
        ? "bg-gray-400"
        : " bg-gray-100 hover:bg-gray-200 active:bg-gray-400", // light colors
    ]
      .filter((v) => !!v)
      .join(" ")}
  >
    {props.children}
  </button>
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

interface IModeHeaderProps {
  heading: string;
  subheading: string;
}

const ModeHeader = ({ heading, subheading }: IModeHeaderProps) => {
  return (
    <>
      <div className="text-lg mb-3">{heading}</div>
      <p className="mb-2 text-sm dark:text-gray-500">{subheading}</p>
    </>
  );
};

const Input = (props: InputProps): React.JSX.Element => {
  const [focus, setFocus] = useState(false);
  return (
    <>
      <div className="mb-1">
        <label htmlFor={props.id}>{props.label}</label>
      </div>
      <div
        className={classList(
          "bg-gray-100 dark:bg-white py-2 px-3 rounded-md focus:border-black border-2 border-solid",
          {
            "border-transparent": () => !focus,
            "border-gray-500 dark:border-gray-500 ": () => focus,
          }
        )}
      >
        <input
          // secrets must not be altered by the keyboard or sent off to a
          // cloud spellchecker
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          {...props}
          style={{ width: "100%" }}
          className="w-max text-sm bg-transparent focus:outline-hidden focus:border-none text-black"
          onFocus={() => {
            setFocus(true);
          }}
          onBlur={() => {
            setFocus(false);
          }}
          id={props.id}
        />
      </div>
    </>
  );
};

const classList = (
  always: string,
  conditionals: { [k in string]: () => boolean }
): string => {
  let result = always;
  for (let [className, cond] of Object.entries(conditionals)) {
    if (cond()) {
      result += ` ${className}`;
    }
  }
  return result;
};

async function timing<T>(label: string, p: Promise<T>): Promise<T> {
  console.time(label);
  try {
    return await p;
  } finally {
    console.timeEnd(label);
  }
}

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

const ErrorBox = ({ message }: { message: string }) => (
  <div className="p-3 mt-1">
    <span className="text-red-600">ERROR:</span> {message}
  </div>
);

const Verify = () => {
  const [secret, setSecret] = useState<string>("");
  const [hash, setHash] = useState<string>("");
  const [result, setResult] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const doVerification = () => {
    if (hash.length === 0 || secret.length === 0) {
      return;
    }
    setBusy(true);
    setResult(null);
    setError(null);
    timing("bcrypt_verify", bcryptVerify(hash, secret))
      .then((ok) => {
        setResult(ok);
      })
      .catch((e) => {
        setError(errorMessage(e));
      })
      .finally(() => {
        setBusy(false);
      });
  };
  return (
    <>
      <ModeHeader
        heading="verify"
        subheading="input a secret and a hash to check if they match"
      />
      {result !== null && (
        <div className="shadow-inner p-4 bg-gray-900 dark:bg-gray-300 rounded-lg">
          {result ? (
            <span>
              &#x1F7E2;&nbsp;<b>OK</b>&nbsp;—&nbsp;secret provided matches the
              hash
            </span>
          ) : (
            <span>
              &#x1F534;&nbsp;<b>FAIL</b>&nbsp;—&nbsp;secret provided DOES NOT
              match the hash
            </span>
          )}
        </div>
      )}
      <Input
        type="text"
        label="secret"
        id="secret"
        value={secret}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            doVerification();
          }
        }}
        onChange={(e) => {
          setSecret(e.target.value);
          setResult(null);
          setError(null);
        }}
      />
      <Input
        type="text"
        label="hash"
        id="hash"
        value={hash}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            doVerification();
          }
        }}
        onChange={(e) => {
          setHash(e.target.value);
          setResult(null);
          setError(null);
        }}
      />
      <Button
        onClick={() => {
          doVerification();
        }}
        disabled={busy || secret.length === 0 || hash.length === 0}
        className="w-full mt-4"
      >
        verify
      </Button>
      {error !== null && <ErrorBox message={error} />}
    </>
  );
};

// bcrypt only operates on the first 72 bytes of a password, and the go
// implementation refuses to generate hashes for anything longer
const MAX_SECRET_BYTES = 72;
const utf8Length = (s: string): number => new TextEncoder().encode(s).length;

const Generate = () => {
  const DEFAULT_COST = 10;
  const WARNING_COST = 14;
  const IMPOSSIBLE_COST = 20;
  const [secret, setSecret] = useState("");
  const [hash, setHash] = useState("");
  const [cost, setCost] = useState(DEFAULT_COST);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const secretBytes = utf8Length(secret);
  const secretTooLong = secretBytes > MAX_SECRET_BYTES;

  const updateHash = () => {
    if (busy || secret.length === 0 || secretTooLong) {
      return;
    }
    setBusy(true);
    setError(null);
    timing("bcrypt_hash", bcryptHash(cost, secret))
      .then((hash) => {
        if (secret.length > 0) {
          setHash(hash);
        } else {
          setHash("");
        }
      })
      .catch((e) => {
        setError(errorMessage(e));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <>
      <ModeHeader
        heading="generate"
        subheading="input a secret to generate a secure bcrypt hash."
      />
      <div>
        <Input
          type="text"
          label="secret"
          id="secret"
          value={secret}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateHash();
            }
          }}
          onChange={(e) => {
            setSecret(e.target.value);
            setError(null);
          }}
        />
        {secretTooLong && (
          <div className="p-3 mt-1">
            <span className="text-red-600">WARNING:</span> bcrypt has a maximum
            password length of 72 bytes (this secret is {secretBytes}). anything
            past that would be silently ignored, so this utility won't generate
            a hash for it. note that non-ASCII characters (accents, emoji, etc.)
            take up more than one byte each. (read more on the{" "}
            <Link
              target="_blank"
              className="underline"
              href="https://en.wikipedia.org/wiki/Bcrypt#Maximum_password_length"
            >
              wiki
            </Link>
            .)
          </div>
        )}
        <Input
          type="number"
          label="cost"
          id="cost"
          value={String(cost)}
          onChange={(e) => {
            const cost = parseInt(e.target.value, 10);
            if (cost <= 31 && cost >= 4) {
              setCost(cost);
            } else if (e.target.value === "") {
              setCost(DEFAULT_COST);
            }
          }}
        />
        {cost > WARNING_COST && cost < IMPOSSIBLE_COST && (
          <div className="p-3 mt-1">
            <span className="text-red-600">WARNING:</span> setting <b>cost</b>{" "}
            greater than 14 leads to very expensive computations. it could take
            a <i>looong</i> time (and is also, not <i>that</i> much more secure,
            so... not worth it really).
          </div>
        )}
        {cost >= IMPOSSIBLE_COST && (
          <div className="p-3 mt-1">
            <span className="text-red-600 font-bold">
              EVEN MORE STERN WARNING:
            </span>{" "}
            setting <b>cost</b> greater than 20 is pretty much not going to work
            unless you have a friggin super-computer or something. but hey... im
            a sign not a cop, do whatever you want!
          </div>
        )}
      </div>
      <div className="mt-2">
        <Input
          type="text"
          label="hash"
          id="hash"
          value={hash}
          onFocus={(e) => {
            e.target.setSelectionRange(0, e.target.value.length);
            e.target.select();
          }}
          readOnly
        />
        <Button
          onClick={() => {
            updateHash();
          }}
          disabled={busy || secret.length === 0 || secretTooLong}
          busy={busy}
          className="w-full mt-4"
        >
          generate
        </Button>
        {error !== null && <ErrorBox message={error} />}
      </div>
    </>
  );
};

function App() {
  const [mode, setMode] = useState("generate");

  return (
    <div className="sm:w-12/12 md:w-5/12 lg:6/12 mx-auto my-4">
      <div className="rounded-lg text-white dark:text-gray-800 bg-gray-800 dark:bg-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <header className="w-max text-xl">bcrypt.ninja</header>
          <img
            src={emoji}
            alt="lock and key emoji"
            style={{ height: "40px" }}
          />
        </div>
        <main>
          <div className="dark:text-gray-500 text-gray-400">
            a{" "}
            <span style={{ position: "relative", top: "2px" }}>&#x1F4AF;</span>{" "}
            percent in-browser&nbsp;
            <Link
              target="_blank"
              className="underline"
              href="https://en.wikipedia.org/wiki/Bcrypt"
            >
              bcrypt
            </Link>
            &nbsp;utility.
          </div>
          <Hr />
          <div>
            <div className="flex justify-center">
              <Button
                className="rounded-l-md"
                active={mode === "generate"}
                onClick={() => {
                  setMode("generate");
                }}
              >
                generate
              </Button>
              <Button
                className="rounded-r-md"
                active={mode === "verify"}
                onClick={() => {
                  setMode("verify");
                }}
              >
                verify
              </Button>
            </div>
            {mode === "generate" && <Generate />}
            {mode === "verify" && <Verify />}
          </div>
        </main>
      </div>
      <footer className="dark:text-gray-600 text-gray-500 text-sm text-center p-4">
        <div className="mb-1">
          made out of boredrom by{" "}
          <Link
            target="_blank"
            className="dark:text-gray-500 text-gray-400 underline"
            href="https://nick.comer.io"
          >
            nick
          </Link>
        </div>
        <div>
          <Link
            target="_blank"
            className="dark:text-gray-500 text-gray-400 underline"
            href="https://github.com/nkcmr/bcrypt.ninja"
          >
            github
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default App;
