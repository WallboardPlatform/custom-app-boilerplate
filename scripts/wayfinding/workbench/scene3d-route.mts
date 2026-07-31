import * as THREE from 'three';

const ROUTE_EPSILON = 0.001;
const ROUTE_AXIS = new THREE.Vector3(0, 1, 0);

export function createRoundedRouteCurve(
	points: readonly THREE.Vector3[],
	cornerRadius: number
): THREE.CurvePath<THREE.Vector3> {
	const curve = new THREE.CurvePath<THREE.Vector3>();

	if (points.length < 2) return curve;
	let cursor = points[0].clone();
	const radius = Math.max(0, cornerRadius);

	for (let index = 1; index < points.length - 1; index += 1) {
		const previous = points[index - 1];
		const corner = points[index];
		const next = points[index + 1];
		const incomingLength = previous.distanceTo(corner);
		const outgoingLength = corner.distanceTo(next);

		if (incomingLength <= ROUTE_EPSILON || outgoingLength <= ROUTE_EPSILON) continue;
		const incoming = corner.clone().sub(previous).normalize();
		const outgoing = next.clone().sub(corner).normalize();
		const alignment = incoming.dot(outgoing);

		// Straight runs do not need additional vertices. Near U-turns are kept
		// logical rather than inventing a loop that could leave walkable space.
		if (alignment > 0.995 || alignment < -0.985 || radius <= ROUTE_EPSILON) continue;
		const offset = Math.min(radius, incomingLength * 0.32, outgoingLength * 0.32);

		if (offset <= ROUTE_EPSILON) continue;
		const entry = corner.clone().addScaledVector(incoming, -offset);
		const exit = corner.clone().addScaledVector(outgoing, offset);

		if (cursor.distanceTo(entry) > ROUTE_EPSILON) {
			curve.add(new THREE.LineCurve3(cursor.clone(), entry.clone()));
		}
		curve.add(new THREE.QuadraticBezierCurve3(entry, corner.clone(), exit));
		cursor = exit;
	}

	const destination = points[points.length - 1].clone();

	if (cursor.distanceTo(destination) > ROUTE_EPSILON) {
		curve.add(new THREE.LineCurve3(cursor, destination));
	}

	return curve;
}

export function positionRouteFlowMarker(
	marker: THREE.Object3D,
	curve: THREE.Curve<THREE.Vector3>,
	progress: number
): void {
	const normalizedProgress = THREE.MathUtils.euclideanModulo(progress, 1);
	const tangent = curve.getTangentAt(normalizedProgress).normalize();

	marker.position.copy(curve.getPointAt(normalizedProgress));

	if (tangent.lengthSq() > ROUTE_EPSILON) {
		marker.quaternion.setFromUnitVectors(ROUTE_AXIS, tangent);
	}
}
