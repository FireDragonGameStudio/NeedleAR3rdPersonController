import { Group } from "three";
import React, {
  useLayoutEffect,
  useRef,
} from "react";
import { useThree } from "@react-three/fiber";
import { unpack } from "./build";

export declare class ComponentProps {
  active?: boolean;
  guid?: string;
  children?: React.ReactNode;
}

export function NeedleComponent({ ...props }) {
  const { type } = props;
  if (!type) return null;
  const state = useThree();
  const ref = useRef() as React.MutableRefObject<Group>;
  // const name = type.name;
  const types = Array.isArray(type) ? type : [type];
  useLayoutEffect(() => {
    unpack(props, ref.current, state, types);
    // return () => {
    //   context?.dispose?.call(context);
    // };
  })

  return <>{props.active !== false && <group ref={ref}>{props.children}</group>}</>;
}

