using UnityEngine;

[ExecuteAlways]
public class OffsetConstraint : MonoBehaviour
{
    public Transform referenceSpace;
    public Transform from;
    
    public bool affectPosition = true;
    public bool affectRotation = true;
    public bool alignLookDirection = false;
    public bool levelLookDirection = true;
    public bool levelPosition = false;
    public Vector3 positionOffset;
    public Vector3 rotationOffset;

    void LateUpdate()
    {
        if (!from) return;
        var pos = @from.position;
        var rot = @from.rotation;
        var offs = positionOffset;
        if (referenceSpace) offs = referenceSpace.TransformDirection(offs); 
        if (affectPosition) transform.position = pos + offs;
        if (levelPosition && referenceSpace)
        {
            // project onto reference space floor plane
            var p = new Plane(referenceSpace.up, referenceSpace.position);
            // var localInRef = referenceSpace.InverseTransformPoint(transform.position);
            // localInRef.y = 0;
            transform.position = p.ClosestPointOnPlane(transform.position);
        }
        if (affectRotation) transform.rotation = rot * Quaternion.Euler(rotationOffset);
        var lookDirection = @from.forward * 50;
        if (levelLookDirection) lookDirection.y = 0;
        if (alignLookDirection) transform.LookAt(lookDirection);
    }

    private void OnDrawGizmos()
    {
        if (!from) return;
        Gizmos.DrawLine(@from.position, transform.position);
    }
}
