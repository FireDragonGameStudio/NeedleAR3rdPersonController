import React from "react";
import { ComponentProps, NeedleComponent } from "../ComponentBase";
import { SyncedRoom as ComponentType } from "@needle-tools/engine";

declare class SyncedRoomProps extends ComponentProps {
    roomName?: string;
}
export function SyncedRoom(props: SyncedRoomProps) {
    return <NeedleComponent type={ComponentType} {...props} />
}