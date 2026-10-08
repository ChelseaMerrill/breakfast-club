"use client";

import type { ComponentProps } from "react";

/** A submit button that asks first (destructive kitchen actions on a shared tablet). */
export function ConfirmSubmit({
  question,
  ...props
}: ComponentProps<"button"> & { question: string }) {
  return (
    <button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    />
  );
}
