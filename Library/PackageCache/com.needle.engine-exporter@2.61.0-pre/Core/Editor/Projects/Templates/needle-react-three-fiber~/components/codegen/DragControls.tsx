import React from "react";
import { ComponentProps, NeedleComponent } from "../ComponentBase";
import { DragControls as ComponentType } from "@needle-tools/engine";

declare class DragControlsProps extends ComponentProps {
}
export function DragControls(props: DragControlsProps) {
    return <NeedleComponent type={ComponentType} {...props} />
}