import React from "react";
import { ComponentProps, NeedleComponent } from "../ComponentBase";
import { Duplicatable as ComponentType } from "@needle-tools/engine";

declare class DuplicatableProps extends ComponentProps {
    object?: string;
    parent?: string;
}
export function Duplicatable(props: DuplicatableProps) {
    return <NeedleComponent type={ComponentType} {...props} />
}