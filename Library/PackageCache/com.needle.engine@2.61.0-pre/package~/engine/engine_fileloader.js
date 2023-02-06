import * as THREE from "three";

export const loader = new THREE.FileLoader();

export async function loadFileAsync(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}