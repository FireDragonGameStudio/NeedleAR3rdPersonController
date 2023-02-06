import React from "react";
import { ComponentProps, NeedleComponent } from "../ComponentBase";
import { Button as ComponentType } from "@needle-tools/engine";

declare class ButtonProps extends ComponentProps {
    onClick?: () => void;
}
export function Button(props: ButtonProps) {
    return <NeedleComponent type={ComponentType} {...props} />
}