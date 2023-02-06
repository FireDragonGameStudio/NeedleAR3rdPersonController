using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[ExecuteAlways]
public class AlignmentConstraint : MonoBehaviour
{
    public Transform from, to;
    public float width = 0.1f;
    public bool centered;
    
    public void LateUpdate()
    {
        if (!from || !to) return;
        transform.position = centered ? (@from.position + to.position) / 2 : from.position;
        transform.LookAt(to.position);
        var dist = Vector3.Distance(from.position, to.position);
        transform.localScale = new Vector3(width, width, dist);
    }
}
