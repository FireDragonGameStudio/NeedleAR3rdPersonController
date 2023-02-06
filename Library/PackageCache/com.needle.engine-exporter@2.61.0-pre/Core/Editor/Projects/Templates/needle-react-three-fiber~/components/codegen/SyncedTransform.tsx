import React from "react";
import { ComponentProps, NeedleComponent } from "../ComponentBase";
import { SyncedTransform as ComponentType } from "@needle-tools/engine";

declare class SyncedTransformProps extends ComponentProps {
}
export function SyncedTransform(props: SyncedTransformProps) {
    return <NeedleComponent type={ComponentType} {...props} />
}