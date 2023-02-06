import { Behaviour, GameObject } from "./Component";
import * as utils from "./../engine/engine_three_utils";
import * as THREE from "three"

export class BasicIKConstraint extends Behaviour {

    private from!: GameObject;
    private to!: GameObject;
    private hint!: GameObject;
    private desiredDistance: number = 1;

    onEnable(): void {
        // console.log(this);
    }

    update() {
        if (!this.from || !this.to || !this.hint) return;

        // console.log(this);

        // find center
        let toPos = utils.getWorldPosition(this.to).clone();
        let fromPos = utils.getWorldPosition(this.from).clone();
        let dist = toPos.distanceTo(fromPos);

        let dir0 = toPos.clone();
        dir0.sub(fromPos);
        let center = fromPos.clone();
        center.add(toPos);
        center.multiplyScalar(0.5);
        
        // find direction we should offset in
        let hintDir = utils.getWorldPosition(this.hint).clone();
        hintDir.sub(center);
        
        let offsetDir = new THREE.Vector3();
        offsetDir.crossVectors(hintDir, dir0);
        offsetDir.crossVectors(dir0, offsetDir);
        offsetDir.normalize();

        let halfDist = dist * 0.5;
        let stretchDistance = Math.max(this.desiredDistance, halfDist);
        let offsetLength = Math.sqrt(stretchDistance * stretchDistance - halfDist * halfDist);
        
        let resultPos = offsetDir.clone();
        resultPos.multiplyScalar(offsetLength);
        resultPos.add(center);
        utils.setWorldPosition(this.gameObject, resultPos);

        let lookPos = center.clone();
        lookPos.sub(offsetDir);
        this.gameObject.lookAt(lookPos);
    }
}