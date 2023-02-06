import React from "react";
import { ComponentProps, NeedleComponent } from "../ComponentBase";
import { ObjectRaycaster as ComponentType } from "@needle-tools/engine";

declare class ObjectRaycasterProps extends ComponentProps {
}
export function ObjectRaycaster(props: ObjectRaycasterProps) {
    return <NeedleComponent type={ComponentType} {...props} />
}