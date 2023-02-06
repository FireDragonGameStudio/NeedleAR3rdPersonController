import React, { useRef } from 'react'
import "@needle-tools/engine";

export default function App() {
  return (
    <>
      <NeedleEngine>
        <Button />
      </NeedleEngine>
    </>
  )
}

function Button() {
  return <button>Click me</button>
}

function NeedleEngine(props) {
    return <needle-engine>
        <div className="loading"></div>
        <div className="desktop ar">
          {props.children}
        </div>
      </needle-engine>;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'needle-engine': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}