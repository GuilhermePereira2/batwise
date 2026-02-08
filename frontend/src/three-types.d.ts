// src/three-types.d.ts
import { ThreeElements } from '@react-three/fiber'

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements extends ThreeElements { }
        }
    }
}