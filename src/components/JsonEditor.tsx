import React from "react";
import SimpleCodeEditor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import { cn } from "@/lib/utils";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const JsonEditor = ({ value, onChange, className, placeholder }: JsonEditorProps) => {
  return (
    <SimpleCodeEditor
      value={value}
      onValueChange={onChange}
      highlight={(code) => Prism.highlight(code, Prism.languages.json, "json")}
      padding={12}
      placeholder={placeholder}
      textareaClassName="outline-none"
      preClassName="!m-0"
      className={cn(
        "min-h-[300px] w-full font-mono text-sm rounded-md border border-code-border bg-code-bg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
      style={{ fontFamily: "inherit" }}
    />
  );
};

export default JsonEditor;
