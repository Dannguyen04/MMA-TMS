"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Input } from "./form";

/** A password field with a show/hide toggle. Pass `autoComplete` ("current-password" or "new-password"). */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, "type">) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <Input {...props} type={visible ? "text" : "password"} className="pr-10" />
            <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:text-fg"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
            >
                {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
        </div>
    );
}
