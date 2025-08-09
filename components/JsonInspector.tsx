"use client";

import React, { useState } from "react";

type JsonInspectorProps = {
  data: unknown;
};

type Ancestors = Array<object>;

function getType(value: unknown):
  | "null"
  | "array"
  | "object"
  | "string"
  | "number"
  | "boolean"
  | "bigint"
  | "undefined"
  | "function"
  | "symbol" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as any;
}

function StringValue({ value }: { value: string }) {
  // Use JSON.stringify for proper escaping and quotes
  return <span className="text-emerald-700">{JSON.stringify(value)}</span>;
}

function NumberValue({ value }: { value: number }) {
  return <span className="text-blue-700">{String(value)}</span>;
}

function BigIntValue({ value }: { value: bigint }) {
  return <span className="text-blue-700">{String(value)}n</span>;
}

function BooleanValue({ value }: { value: boolean }) {
  return <span className="text-purple-700">{value ? "true" : "false"}</span>;
}

function NullValue() {
  return <span className="text-gray-500 italic">null</span>;
}

function UndefinedValue() {
  return <span className="text-gray-400 italic">undefined</span>;
}

function FunctionValue({ value }: { value: Function }) {
  const name = value.name && value.name.length > 0 ? value.name : "anonymous";
  return (
    <span className="text-pink-600">{`ƒ ${name}()`}</span>
  );
}

function SymbolValue({ value }: { value: symbol }) {
  const desc = (value as any).description ?? "";
  return <span className="text-pink-600">{`Symbol(${desc})`}</span>;
}

function renderPrimitive(value: unknown): React.ReactNode {
  const t = getType(value);
  switch (t) {
    case "null":
      return <NullValue />;
    case "string":
      return <StringValue value={value as string} />;
    case "number":
      return <NumberValue value={value as number} />;
    case "bigint":
      return <BigIntValue value={value as bigint} />;
    case "boolean":
      return <BooleanValue value={value as boolean} />;
    case "undefined":
      return <UndefinedValue />;
    case "function":
      return <FunctionValue value={value as Function} />;
    case "symbol":
      return <SymbolValue value={value as symbol} />;
    default:
      return <span className="text-gray-700">{"[unknown]"}</span>;
  }
}

function summarize(value: unknown, maxEntries: number = 3): string {
  const t = getType(value);
  try {
    if (t === "array") {
      const arr = value as Array<unknown>;
      const parts: string[] = [];
      for (let i = 0; i < Math.min(arr.length, maxEntries); i++) {
        const v = arr[i];
        const vt = getType(v);
        if (vt === "string") parts.push(JSON.stringify(v as string));
        else if (vt === "number" || vt === "bigint" || vt === "boolean")
          parts.push(String(v));
        else if (vt === "null") parts.push("null");
        else if (vt === "undefined") parts.push("undefined");
        else if (vt === "array") parts.push("[…]");
        else if (vt === "object") parts.push("{…}");
        else parts.push(vt);
      }
      if (arr.length > maxEntries) parts.push("…");
      return `[${parts.join(", " )}]`;
    }
    if (t === "object") {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      const parts: string[] = [];
      for (let i = 0; i < Math.min(keys.length, maxEntries); i++) {
        const k = keys[i];
        const v = obj[k];
        const vt = getType(v);
        let pv = "";
        if (vt === "string") pv = JSON.stringify(v as string);
        else if (vt === "number" || vt === "bigint" || vt === "boolean")
          pv = String(v);
        else if (vt === "null") pv = "null";
        else if (vt === "undefined") pv = "undefined";
        else if (vt === "array") pv = "[…]";
        else if (vt === "object") pv = "{…}";
        else pv = vt;
        parts.push(`${k}: ${pv}`);
      }
      if (keys.length > maxEntries) parts.push("…");
      return `{ ${parts.join(", " )} }`;
    }
  } catch (_) {
    // ignore preview errors
  }
  return "";
}

type NodeProps = {
  name?: string;
  value: unknown;
  depth: number;
  ancestors: Ancestors;
  isRoot?: boolean;
};

function InspectorNode({ name, value, depth, ancestors, isRoot = false }: NodeProps) {
  const t = getType(value);
  const isExpandable = t === "array" || t === "object";
  const [open, setOpen] = useState<boolean>(isRoot || depth < 1);

  if (!isExpandable) {
    return (
      <div className="whitespace-pre leading-6">
        {name !== undefined && (
          <span className="text-sky-700">{name}</span>
        )}
        {name !== undefined && <span>: </span>}
        {renderPrimitive(value)}
      </div>
    );
  }

  if (!isRoot && value && typeof value === "object") {
    if (ancestors.includes(value as object)) {
      return (
        <div className="leading-6">
          {name !== undefined && (
            <span className="text-sky-700">{name}</span>
          )}
          {name !== undefined && <span>: </span>}
          <span className="text-gray-500 italic">(Circular)</span>
        </div>
      );
    }
  }

  let entries: Array<[string, unknown]> = [];
  let count = 0;
  let isArray = false;

  if (Array.isArray(value)) {
    isArray = true;
    const arr = value as Array<unknown>;
    count = arr.length;
    entries = arr.map((v, i) => [String(i), v]);
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    count = keys.length;
    entries = keys.map((k) => [k, obj[k]]);
  }

  const preview = !open ? summarize(value) : "";
  const nextAncestors: Ancestors = value && typeof value === "object" ? [...ancestors, value as object] : ancestors;

  return (
    <div className="leading-6">
      <div className="flex items-start">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mr-1 text-gray-500 hover:text-gray-700 select-none"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? "▾" : "▸"}
        </button>
        {name !== undefined && (
          <div className="text-sky-700 mr-1">{name}:</div>
        )}
        <div>
          <span className="text-amber-700">
            {isArray ? "[" : "{"}
          </span>
          <span className="ml-1 text-gray-600">
            {isArray ? `${count} items` : `${count} keys`}
          </span>
          <span className="ml-1 text-amber-700">
            {isArray ? "]" : "}"}
          </span>
        </div>
      </div>
      {open && (
        <div className="ml-4 pl-2 border-l border-gray-800">
          {(() => {
            return entries.map(([k, v]) => (
              <InspectorNode
                key={k}
                name={isArray ? `[${k}]` : k}
                value={v}
                depth={depth + 1}
                ancestors={nextAncestors}
              />
            ));
          })()}
        </div>
      )}
    </div>
  );
}

export default function JsonInspector({ data }: JsonInspectorProps) {
  const rootAncestors: Ancestors = [];
  return (
    <div className="font-mono text-xs text-gray-400">
      <InspectorNode value={data} depth={0} ancestors={rootAncestors} isRoot />
    </div>
  );
}
